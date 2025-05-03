import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { QueueMessage, IQueueService } from './interfaces/queue.interface';
import { IKafkaService } from './interfaces/kafka.interface';
import { KAFKA_SERVICE, DEAD_LETTER_SERVICE } from './constants';
import {
  IMetricsService,
  METRICS_SERVICE,
} from '../provider/interfaces/metrics.interface';
import { IDeadLetterService } from './interfaces/dead-letter.interface';

@Injectable()
export class QueueService implements IQueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly topic: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(StatusReport)
    private readonly statusReportRepository: Repository<StatusReport>,
    @Inject(KAFKA_SERVICE)
    private readonly kafkaService: IKafkaService,
    @Inject(DEAD_LETTER_SERVICE)
    private readonly deadLetterService: IDeadLetterService,
    private readonly configService: ConfigService,
    @Inject(METRICS_SERVICE)
    private readonly metricsService: IMetricsService,
  ) {
    this.topic = this.configService.get('kafka.topics.smsRequests');
    this.maxRetries = this.configService.get('sms.maxRetries', 3);
    this.retryDelay = this.configService.get('sms.retryDelay', 5000);
  }

  async enqueueMessage(message: QueueMessage): Promise<void> {
    try {
      await this.kafkaService.sendMessage(this.topic, [
        {
          key: message.messageId,
          value: JSON.stringify({
            ...message,
            timestamp: message.timestamp || Date.now().toString(),
          }),
        },
      ]);
      this.logger.debug(`消息已入队: ${message.messageId}`);
    } catch (error) {
      this.logger.error(`消息入队失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async processMessage(message: QueueMessage): Promise<void> {
    try {
      let retries = 0;
      let success = false;

      while (retries < this.maxRetries && !success) {
        try {
          // 处理消息的逻辑
          this.logger.debug(`处理消息: ${message.messageId}`);
          success = true;
        } catch (error) {
          this.logger.warn(
            `处理消息失败 (重试 ${retries + 1}/${this.maxRetries}): ${
              error.message
            }`,
          );
          retries++;
          if (retries < this.maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.retryDelay),
            );
          }
        }
      }

      if (!success) {
        const deadLetterMessage = {
          originalMessage: message,
          metadata: {
            retryCount: retries,
            lastRetryTime: new Date(),
            failureReason: 'Max retries exceeded',
          },
        };
        await this.handleDeadLetter(
          deadLetterMessage,
          new Error('Max retries exceeded'),
        );
      }
    } catch (error) {
      this.logger.error(`处理消息失败: ${error.message}`, error.stack);
      const deadLetterMessage = {
        originalMessage: message,
        metadata: {
          retryCount: message.retryCount || 0,
          lastRetryTime: new Date(),
          failureReason: error.message,
        },
      };
      await this.handleDeadLetter(deadLetterMessage, error);
    }
  }

  async handleDeadLetter(
    message: {
      originalMessage: QueueMessage;
      metadata: {
        retryCount: number;
        lastRetryTime: Date;
        failureReason: string;
      };
    },
    error: Error,
  ): Promise<void> {
    try {
      const dbMessage = await this.messageRepository.findOne({
        where: { messageId: message.originalMessage.messageId },
      });

      if (dbMessage) {
        await this.deadLetterService.handleFailedMessage(
          dbMessage,
          error,
          message.metadata,
        );
      }
    } catch (error) {
      this.logger.error(`处理死信队列失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
