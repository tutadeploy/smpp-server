import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../entities/message.entity';
import { BalanceService } from './balance.service';
import { SmsQueueService } from '../queue/sms-queue.service';
import { MetricsService } from '../monitoring/metrics.service';
import { SmppClientService } from '../provider/smpp-client.service';
import { MessageStatus } from '../entities/message.entity';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly balanceService: BalanceService,
    private readonly smsQueueService: SmsQueueService,
    private readonly metricsService: MetricsService,
    private readonly smppClientService: SmppClientService,
  ) {}

  /**
   * 处理SMS发送请求
   */
  async processSendRequest(data: {
    appId: string;
    phoneNumbers: string[];
    content: string;
    senderId?: string;
    orderId?: string;
    priority?: number;
    scheduleTime?: Date;
  }): Promise<any> {
    this.logger.log(`[调试] 处理批量请求，数量: ${data.phoneNumbers.length}`);
    const {
      appId,
      phoneNumbers,
      content,
      senderId,
      orderId,
      priority = 1,
      scheduleTime,
    } = data;

    try {
      // 1. 验证请求参数
      await this.validateSendRequest(data);

      // 2. 检查账户余额是否足够
      const hasEnoughBalance = await this.balanceService.checkBalance(
        appId,
        phoneNumbers.length,
      );
      if (!hasEnoughBalance) {
        this.logger.warn(`[余额不足] 账户 ${appId} 余额不足，无法发送任何短信`);
        return {
          status: '1',
          reason: 'INSUFFICIENT_BALANCE',
          success: '0',
          fail: String(phoneNumbers.length),
          array: [],
        };
      }

      // 3. 批量创建消息记录
      const messageId = orderId || uuidv4();
      const messages = await this.createMessageRecords({
        messageId,
        appId,
        phoneNumbers,
        content,
        senderId,
        priority,
        scheduleTime,
      });

      // 4. 将消息加入队列
      await this.smsQueueService.enqueueSmsRequest({
        requestId: messageId,
        appId,
        phoneNumbers,
        content,
        senderId,
        orderId,
        priority,
        scheduleTime: scheduleTime?.toISOString(),
        timestamp: new Date().toISOString(),
        providerId: 'default',
      });

      // 5. 记录指标
      this.metricsService.incrementCounter('sms.request.total');
      this.metricsService.incrementCounter(
        'sms.request.phones',
        {},
        phoneNumbers.length,
      );

      // 6. 返回处理结果
      this.logger.log(`短信发送成功，共${phoneNumbers.length}条`);
      const response = {
        status: '0',
        reason: 'message queued',
        success: String(phoneNumbers.length),
        fail: '0',
        array: messages.map((message) => ({
          msgId: message.messageId,
          number: message.phoneNumber,
          orderId: message.orderId || '',
        })),
      };

      return response;
    } catch (error) {
      this.logger.error(
        `处理SMS请求失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.metricsService.incrementCounter('sms.request.error');

      return this.handleSendError(
        error instanceof Error ? error : new Error('Unknown error'),
        phoneNumbers.length,
      );
    }
  }

  /**
   * 验证发送请求参数
   */
  private async validateSendRequest(data: {
    appId: string;
    phoneNumbers: string[];
    content: string;
  }): Promise<void> {
    const { appId, phoneNumbers, content } = data;

    if (!appId) {
      throw new Error('INVALID_APP_ID');
    }

    if (!phoneNumbers || phoneNumbers.length === 0) {
      throw new Error('INVALID_PHONE_NUMBERS');
    }

    if (!content || content.length === 0) {
      throw new Error('INVALID_CONTENT');
    }

    // 验证手机号格式
    const invalidPhones = phoneNumbers.filter(
      (phone) => !this.isValidPhoneNumber(phone),
    );
    if (invalidPhones.length > 0) {
      throw new Error(`INVALID_PHONE_FORMAT: ${invalidPhones.join(', ')}`);
    }

    // 验证内容长度
    if (content.length > 1000) {
      throw new Error('CONTENT_TOO_LONG');
    }
  }

  /**
   * 创建消息记录
   */
  private async createMessageRecords(data: {
    messageId: string;
    appId: string;
    phoneNumbers: string[];
    content: string;
    senderId?: string;
    priority?: number;
    scheduleTime?: Date;
  }): Promise<Message[]> {
    const {
      messageId,
      appId,
      phoneNumbers,
      content,
      senderId,
      priority,
      scheduleTime,
    } = data;

    const messages = phoneNumbers.map((phoneNumber) => {
      const message = new Message();
      // 使用更短的格式：原始 messageId + 电话号码后 8 位 + 时间戳后 8 位 + 随机 4 位
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substr(2, 4);
      const phoneSuffix = phoneNumber.slice(-8);
      message.messageId = `${messageId}_${phoneSuffix}_${timestamp}_${random}`;
      message.appId = appId;
      message.phoneNumber = phoneNumber;
      message.content = content;
      message.senderId = senderId;
      message.priority = priority || 1;
      message.scheduleTime = scheduleTime;
      message.status = 'QUEUED';
      return message;
    });

    // 使用批量插入
    return await this.messageRepository.save(messages);
  }

  /**
   * 验证手机号格式
   */
  private isValidPhoneNumber(phone: string): boolean {
    // 基本的手机号格式验证
    return /^\+?[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * 处理发送错误
   */
  private handleSendError(error: Error, phoneCount: number): any {
    return {
      status: '1',
      reason: error.message,
      success: '0',
      fail: String(phoneCount),
      array: [],
    };
  }

  /**
   * 获取消息发送状态
   */
  async getMessageStatus(appId: string, messageId: string): Promise<any> {
    try {
      const message = await this.messageRepository.findOne({
        where: { appId, messageId },
      });

      if (!message) {
        throw new Error('MESSAGE_NOT_FOUND');
      }

      // 如果消息状态是已发送或排队中，尝试从SMPP客户端获取最新状态
      if (['SENT', 'QUEUED'].includes(message.status)) {
        const updatedStatus =
          await this.smppClientService.queryMessageStatus(messageId);
        if (updatedStatus) {
          message.status = updatedStatus as MessageStatus;
          await this.messageRepository.save(message);
        }
      }

      return {
        messageId: message.messageId,
        appId: message.appId,
        phoneNumber: message.phoneNumber,
        statusCode: message.status,
        content: message.content,
        createTime: message.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`获取消息状态失败: ${error.message}`, error.stack);
      return {
        status: '1',
        reason:
          error.message === 'MESSAGE_NOT_FOUND' ? '消息不存在' : '查询状态失败',
        messageId,
      };
    }
  }
}
