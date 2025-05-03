import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatusEnum } from '../../entities/message.entity';
import { StatusReport } from '../../entities/status-report.entity';
import { ISmsQueueService } from '../interfaces/sms-queue.interface';
import { QueueMessage } from '../interfaces/queue.interface';
import { QUEUE_SERVICE } from '../constants';
import { IQueueService } from '../interfaces/queue.interface';
import { ProviderService } from '../../provider/provider.service';
import { MetricsService } from '../../monitoring/metrics.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsQueueService implements ISmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(StatusReport)
    private readonly statusReportRepository: Repository<StatusReport>,
    @Inject(QUEUE_SERVICE)
    private readonly queueService: IQueueService,
    private readonly providerService: ProviderService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.maxRetries = this.configService.get('sms.maxRetries', 3);
    this.retryDelay = this.configService.get('sms.retryDelay', 5000);
  }

  /**
   * 处理队列中的短信消息
   * @param message 队列消息
   */
  async processQueuedMessage(message: QueueMessage): Promise<boolean> {
    this.logger.debug(`Processing message: ${message.messageId}`);
    this.metricsService.incrementCounter('message_processing');

    try {
      // 查找消息记录
      const msgEntity = await this.messageRepository.findOne({
        where: { messageId: message.messageId },
      });

      if (!msgEntity) {
        this.logger.warn(`Message not found: ${message.messageId}`);
        return false;
      }

      // 更新消息状态为处理中
      msgEntity.status = MessageStatusEnum.PROCESSING;
      await this.messageRepository.save(msgEntity);

      // 通过Provider发送短信
      msgEntity.status = MessageStatusEnum.SENDING;
      await this.messageRepository.save(msgEntity);

      const result = await this.providerService.sendMessage({
        messageId: message.messageId,
        destination: message.phoneNumber,
        message: message.content,
        phoneNumber: message.phoneNumber,
        content: message.content,
        senderId: message.senderId || '',
        providerId: message.providerId,
        orderId: message.orderId,
      });

      if (result.status === 'success') {
        msgEntity.status = MessageStatusEnum.DELIVERED;
        msgEntity.providerMessageId = result.messageId;
        msgEntity.sendTime = new Date();
        await this.messageRepository.save(msgEntity);
        this.metricsService.incrementCounter('message_sent_success');
        return true;
      } else {
        // 发送失败处理
        if (msgEntity.retryCount < this.maxRetries) {
          msgEntity.retryCount += 1;
          msgEntity.status = MessageStatusEnum.QUEUED;
          msgEntity.errorMessage = result.error || 'Unknown error';
          await this.messageRepository.save(msgEntity);

          // 将消息重新入队
          setTimeout(async () => {
            await this.queueService.enqueueMessage(message);
          }, this.retryDelay * msgEntity.retryCount);

          this.metricsService.incrementCounter('message_retry');
          return false;
        } else {
          // 超过重试次数，标记为失败
          msgEntity.status = MessageStatusEnum.FAILED;
          msgEntity.errorMessage = result.error || 'Max retries exceeded';
          await this.messageRepository.save(msgEntity);
          this.metricsService.incrementCounter('message_failed');
          return false;
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.messageId}: ${error.message}`,
        error.stack,
      );
      this.metricsService.incrementCounter('message_processing_error');
      return false;
    }
  }

  /**
   * 批量处理队列中的短信消息
   * @param messages 队列消息数组
   */
  async processBatchMessages(messages: QueueMessage[]): Promise<{
    success: number;
    fail: number;
  }> {
    this.logger.debug(`Processing batch of ${messages.length} messages`);
    let success = 0;
    let fail = 0;

    for (const message of messages) {
      const result = await this.processQueuedMessage(message);
      if (result) {
        success++;
      } else {
        fail++;
      }
    }

    return { success, fail };
  }

  /**
   * 重试发送失败的消息
   * @param messageId 消息ID
   */
  async retryFailedMessage(messageId: string): Promise<boolean> {
    this.logger.debug(`Retrying failed message: ${messageId}`);

    try {
      const message = await this.messageRepository.findOne({
        where: { messageId },
      });

      if (!message) {
        this.logger.warn(`Message not found for retry: ${messageId}`);
        return false;
      }

      if (message.status !== MessageStatusEnum.FAILED) {
        this.logger.warn(
          `Cannot retry message with status ${message.status}: ${messageId}`,
        );
        return false;
      }

      // 重置重试计数
      message.retryCount = 0;
      message.status = MessageStatusEnum.QUEUED;
      await this.messageRepository.save(message);

      // 重新入队
      const queueMessage: QueueMessage = {
        messageId: message.messageId,
        appId: message.appId,
        phoneNumber: message.phoneNumber,
        content: message.content,
        senderId: message.senderId,
        timestamp: new Date().toISOString(),
        providerId: 'default',
      };

      await this.queueService.enqueueMessage(queueMessage);
      this.metricsService.incrementCounter('message_manual_retry');
      return true;
    } catch (error) {
      this.logger.error(
        `Error retrying message ${messageId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
