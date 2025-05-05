import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  MessageStatusEnum,
  MessageStatus,
} from '../entities/message.entity';
import { BalanceService } from './balance.service';
import { MetricsService } from '../monitoring/metrics.service';
import { ProviderService } from '../provider/provider.service';
import { ConfigService } from '@nestjs/config';
import { SendSmsDto } from '../api/dto/send-sms.dto';
import { SmsResponseDto } from '../api/dto/response.dto';
import { ISmsService } from './interfaces/sms.interface';
import { QUEUE_SERVICE } from '../queue/constants';
import { IQueueService } from '../queue/interfaces/queue.interface';
import { QueueMessage } from '../queue/interfaces/queue.interface';
import { BALANCE_SERVICE } from './services.constants';

@Injectable()
export class SmsService implements ISmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly pricePerSms: number;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Inject(BALANCE_SERVICE)
    private readonly balanceService: BalanceService,
    @Inject(QUEUE_SERVICE)
    private readonly queueService: IQueueService,
    private readonly metricsService: MetricsService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
  ) {
    this.pricePerSms =
      this.configService.get<number>('sms.pricePerSms') || 0.042;
  }

  async processSendRequest(data: SendSmsDto): Promise<SmsResponseDto> {
    this.logger.log(
      `[调试] 处理批量请求，数量: ${data.numbers.split(',').length}`,
    );
    const phoneNumbers = data.numbers.split(',');

    try {
      // 1. 验证请求参数
      await this.validateSendRequest({
        appId: data.appId,
        phoneNumbers,
        content: data.content,
      });

      // 2. 检查账户余额是否足够
      const hasEnoughBalance = await this.balanceService.checkBalance(
        data.appId,
        phoneNumbers.length,
      );
      if (!hasEnoughBalance) {
        this.logger.warn(
          `[余额不足] 账户 ${data.appId} 余额不足，无法发送任何短信`,
        );
        this.metricsService.incrementCounter(
          'sms_request_insufficient_balance',
        );
        return {
          status: '1',
          reason: 'INSUFFICIENT_BALANCE',
          success: '0',
          fail: String(phoneNumbers.length),
          array: [],
        };
      }

      // 3. 批量创建消息记录
      const messageId = data.orderId || uuidv4();
      const messages = await this.createMessageRecords({
        messageId,
        appId: data.appId,
        phoneNumbers,
        content: data.content,
        senderId: data.senderId,
        priority: 1,
      });
      messages.forEach((msg) => {
        this.logger.log(
          `[入库] messageId=${msg.messageId}, phone=${msg.phoneNumber}, status=${msg.status}`,
        );
      });

      // 4. 在发送短信前扣除余额
      const totalAmount = phoneNumbers.length * this.pricePerSms;
      await this.balanceService.deductBalance(data.appId, totalAmount);

      // 5. 将消息加入队列
      for (const message of messages) {
        const queueMessage: QueueMessage = {
          messageId: message.messageId,
          appId: data.appId,
          phoneNumber: message.phoneNumber,
          content: data.content,
          senderId: data.senderId,
          orderId: data.orderId,
          timestamp: new Date().toISOString(),
          providerId: 'default',
        };
        this.logger.log(
          `[入队] messageId=${queueMessage.messageId}, phone=${queueMessage.phoneNumber}`,
        );
        await this.queueService.enqueueMessage(queueMessage);
      }

      // 6. 记录指标
      this.metricsService.incrementCounter('sms_request_total');
      this.metricsService.incrementCounter('sms_request_phones', {
        status: 'success',
      });

      // 7. 返回处理结果
      this.logger.log(`短信发送成功，共${phoneNumbers.length}条`);
      return {
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
    } catch (error) {
      this.logger.error(
        `处理SMS请求失败: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      this.metricsService.incrementCounter('sms_request_error');

      return this.handleSendError(
        error instanceof Error ? error : new Error('Unknown error'),
        phoneNumbers.length,
      );
    }
  }

  async getMessageStatus(
    appId: string,
    messageId: string,
  ): Promise<SmsResponseDto> {
    try {
      const message = await this.messageRepository.findOne({
        where: { appId, messageId },
      });

      if (!message) {
        throw new Error('MESSAGE_NOT_FOUND');
      }

      // 如果消息状态是已发送或排队中，尝试从提供商获取最新状态
      if (
        message.status === MessageStatusEnum.SENDING ||
        message.status === MessageStatusEnum.QUEUED
      ) {
        const provider = await this.providerService.getActiveProvider();
        if (provider) {
          const updatedStatus = await this.providerService.queryMessageStatus(
            provider.providerId,
            messageId,
          );
          if (updatedStatus) {
            message.status = updatedStatus.status as MessageStatus;
            await this.messageRepository.save(message);
          }
        }
      }

      return {
        status: '0',
        reason: 'success',
        success: message.status === MessageStatusEnum.DELIVERED ? '1' : '0',
        fail: message.status === MessageStatusEnum.FAILED ? '1' : '0',
        array: [
          {
            msgId: message.messageId,
            number: message.phoneNumber,
            orderId: message.orderId || '',
          },
        ],
      };
    } catch (error) {
      this.logger.error(`获取消息状态失败: ${error.message}`, error.stack);
      return {
        status: '1',
        reason:
          error.message === 'MESSAGE_NOT_FOUND' ? '消息不存在' : '查询状态失败',
        success: '0',
        fail: '1',
        array: [],
      };
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatusEnum,
  ): Promise<void> {
    try {
      const message = await this.messageRepository.findOne({
        where: { messageId },
      });

      if (message) {
        const oldStatus = message.status;
        message.status = status;
        await this.messageRepository.save(message);
        this.logger.log(
          `[状态变更] messageId=${message.messageId}, phone=${message.phoneNumber}, from=${oldStatus}, to=${status}`,
        );
      }
    } catch (error) {
      this.logger.error(`更新消息状态失败: ${error.message}`, error.stack);
      throw error;
    }
  }

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

  private async createMessageRecords(data: {
    messageId: string;
    appId: string;
    phoneNumbers: string[];
    content: string;
    senderId?: string;
    priority?: number;
  }): Promise<Message[]> {
    const { messageId, appId, phoneNumbers, content, senderId, priority } =
      data;

    const messages = phoneNumbers.map((phoneNumber) => {
      const message = new Message();
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substr(2, 4);
      const phoneSuffix = phoneNumber.slice(-8);
      message.messageId = `${messageId}_${phoneSuffix}_${timestamp}_${random}`;
      message.appId = appId;
      message.phoneNumber = phoneNumber;
      message.content = content;
      message.senderId = senderId;
      message.priority = priority || 1;
      message.status = MessageStatusEnum.QUEUED;
      return message;
    });

    return await this.messageRepository.save(messages);
  }

  private isValidPhoneNumber(phone: string): boolean {
    return /^\d{8,}$/.test(phone);
  }

  private handleSendError(error: Error, phoneCount: number): SmsResponseDto {
    return {
      status: '1',
      reason: error.message,
      success: '0',
      fail: String(phoneCount),
      array: [],
    };
  }
}
