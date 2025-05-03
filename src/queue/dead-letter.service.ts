import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatusEnum } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { IDeadLetterService } from './interfaces/dead-letter.interface';
import { IKafkaService } from './interfaces/kafka.interface';
import { KAFKA_SERVICE } from './constants';
import { ProviderStatus } from '../provider/interfaces/provider.interface';
import {
  IMetricsService,
  METRICS_SERVICE,
} from '../provider/interfaces/metrics.interface';

export interface DeadLetterMessage {
  messageId: string;
  error: string;
  retryCount: number;
  timestamp: string;
}

export interface StatusReportDeadLetterMessage {
  messageId: string;
  providerMessageId: string;
  status: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata: {
    retryCount: number;
    lastRetryTime: string;
    failureReason: string;
    timestamp: string;
  };
}

@Injectable()
export class DeadLetterService implements IDeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  private readonly deadLetterTopic: string;
  private readonly statusReportDeadLetterTopic: string;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(StatusReport)
    private readonly statusReportRepository: Repository<StatusReport>,
    @Inject(KAFKA_SERVICE)
    private readonly kafkaService: IKafkaService,
    @Inject(METRICS_SERVICE)
    private readonly metricsService: IMetricsService,
  ) {
    this.deadLetterTopic =
      this.configService.get<string>('kafka.topics.deadLetter') ||
      'sms-dead-letter';
    this.statusReportDeadLetterTopic =
      this.configService.get<string>('kafka.topics.statusReportDeadLetter') ||
      'status-report-dead-letter';
    this.maxRetries = this.configService.get<number>('maxRetries') || 3;
  }

  /**
   * 处理失败的消息
   * @param message 消息实体
   * @param error 错误信息
   */
  async handleFailedMessage(
    message: Message,
    error: Error,
    metadata: {
      retryCount: number;
      lastRetryTime: Date;
      failureReason: string;
    },
  ): Promise<void> {
    try {
      this.logger.error(
        `处理失败消息: ${message.messageId}, 错误: ${error.message}`,
        error.stack,
      );

      message.status = MessageStatusEnum.ERROR;
      message.errorMessage = error.message;
      message.retryCount = metadata.retryCount;

      await this.messageRepository.save(message);

      // 发送到死信队列
      await this.kafkaService.sendMessage('dead-letter.messages', [
        {
          key: message.messageId,
          value: JSON.stringify({
            messageId: message.messageId,
            error: error.message,
            retryCount: metadata.retryCount,
            timestamp: new Date().toISOString(),
          }),
        },
      ]);
    } catch (err) {
      this.logger.error(`处理失败消息时发生错误: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * 处理失败的状态报告
   * @param statusReport 状态报告实体
   * @param error 错误信息
   * @param metadata 元数据信息
   */
  async handleFailedStatusReport(
    report: StatusReport,
    error: Error,
    metadata: {
      retryCount: number;
      lastRetryTime: Date;
      failureReason: string;
    },
  ): Promise<void> {
    try {
      this.logger.error(
        `处理失败状态报告: ${report.messageId}, 错误: ${error.message}`,
        error.stack,
      );

      // 发送到死信队列
      await this.kafkaService.sendMessage('dead-letter.status-reports', [
        {
          key: report.messageId,
          value: JSON.stringify({
            messageId: report.messageId,
            providerMessageId: report.providerMessageId,
            status: report.status,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            metadata: {
              ...metadata,
              lastRetryTime: metadata.lastRetryTime.toISOString(),
              timestamp: new Date().toISOString(),
            },
          }),
        },
      ]);
    } catch (err) {
      this.logger.error(
        `处理失败状态报告时发生错误: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  async retryMessage(
    message: DeadLetterMessage | StatusReportDeadLetterMessage,
  ): Promise<void> {
    try {
      this.logger.log(`尝试重试消息: ${message.messageId}`);

      if ('providerMessageId' in message) {
        // 处理状态报告重试
        const statusReport = await this.statusReportRepository.findOne({
          where: { messageId: message.messageId },
        });

        if (statusReport) {
          statusReport.status = message.status as ProviderStatus;
          statusReport.errorMessage = message.error.message;
          await this.statusReportRepository.save(statusReport);
        }
      } else {
        // 处理普通消息重试
        const msg = await this.messageRepository.findOne({
          where: { messageId: message.messageId },
        });

        if (msg) {
          msg.status = MessageStatusEnum.QUEUED;
          msg.errorMessage = message.error;
          msg.retryCount = message.retryCount;
          await this.messageRepository.save(msg);
        }
      }

      this.metricsService.incrementCounter('dead_letter_retry_success');
    } catch (error) {
      this.logger.error(`重试消息失败: ${error.message}`, error.stack);
      this.metricsService.incrementCounter('dead_letter_retry_failed');
      throw error;
    }
  }
}
