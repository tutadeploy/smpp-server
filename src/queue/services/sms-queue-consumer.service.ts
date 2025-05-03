import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KAFKA_SERVICE } from '../constants';
import { IKafkaService } from '../interfaces/kafka.interface';
import { SMS_QUEUE_SERVICE } from '../sms-queue.constants';
import { ISmsQueueService } from '../interfaces/sms-queue.interface';
import { MetricsService } from '../../monitoring/metrics.service';
import { QueueMessage } from '../interfaces/queue.interface';

@Injectable()
export class SmsQueueConsumerService implements OnModuleInit {
  private readonly logger = new Logger(SmsQueueConsumerService.name);
  private readonly topic: string;
  private readonly groupId: string;
  private readonly batchSize: number;
  private readonly processingInterval: number;
  private isProcessing = false;
  private messageHandler: (message: any) => Promise<void>;

  constructor(
    @Inject(KAFKA_SERVICE)
    private readonly kafkaService: IKafkaService,
    @Inject(SMS_QUEUE_SERVICE)
    private readonly smsQueueService: ISmsQueueService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.topic = this.configService.get('kafka.topics.smsRequests');
    this.groupId = this.configService.get('kafka.consumer.groupId');
    this.batchSize = this.configService.get('sms.batchSize', 10);
    this.processingInterval = this.configService.get(
      'sms.processingInterval',
      1000,
    );
  }

  async onModuleInit() {
    this.logger.log(`Initializing SMS Queue Consumer for topic ${this.topic}`);
    await this.setupConsumer();
  }

  private async setupConsumer() {
    try {
      await this.kafkaService.connect();
      this.messageHandler = this.createMessageHandler();
      await this.kafkaService.registerHandler(this.topic, this.messageHandler);
      this.logger.log(`Consumer registered handler for topic ${this.topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to setup consumer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private createMessageHandler() {
    const messageBuffer: QueueMessage[] = [];
    let processingTimer: NodeJS.Timeout | null = null;

    // 处理消息批次
    const processBatch = async () => {
      if (messageBuffer.length === 0) return;

      const messagesToProcess = [...messageBuffer];
      messageBuffer.length = 0; // 清空缓冲区

      try {
        this.logger.debug(
          `Processing batch of ${messagesToProcess.length} messages`,
        );
        this.metricsService.incrementCounter('message_batch_process', {
          count: String(messagesToProcess.length),
        });

        const result = await this.smsQueueService.processBatchMessages(
          messagesToProcess,
        );

        this.logger.log(
          `Batch processing complete: ${result.success} success, ${result.fail} fail`,
        );

        this.metricsService.incrementCounter('message_processed_success', {
          count: String(result.success),
        });

        this.metricsService.incrementCounter('message_processed_fail', {
          count: String(result.fail),
        });
      } catch (error) {
        this.logger.error(
          `Error processing batch: ${error.message}`,
          error.stack,
        );
        this.metricsService.incrementCounter('message_batch_process_error');
      }
    };

    // 返回消息处理函数
    return async (message: any) => {
      try {
        let queueMessage: QueueMessage;
        if (message && message.value) {
          // Kafka原生格式
          try {
            queueMessage = JSON.parse(message.value.toString());
          } catch (parseError) {
            this.logger.error('Failed to parse Kafka message value', {
              value: message.value,
              error: parseError,
            });
            this.metricsService.incrementCounter('message_processing_error');
            return;
          }
        } else if (message && message.messageId) {
          // 已经是业务对象
          queueMessage = message;
        } else {
          this.logger.error('Kafka message is invalid', { message });
          this.metricsService.incrementCounter('message_processing_error');
          return;
        }
        messageBuffer.push(queueMessage);

        // 如果消息数量达到批次大小，立即处理
        if (messageBuffer.length >= this.batchSize) {
          if (processingTimer) {
            clearTimeout(processingTimer);
            processingTimer = null;
          }
          await processBatch();
        }
        // 否则设置定时器延迟处理
        else if (!processingTimer) {
          processingTimer = setTimeout(async () => {
            processingTimer = null;
            await processBatch();
          }, this.processingInterval);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process message: ${error.message}`,
          error.stack,
        );
        this.metricsService.incrementCounter('message_processing_error');
      }
    };
  }
}
