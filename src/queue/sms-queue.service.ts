import { Injectable, Logger } from '@nestjs/common';
import { ProviderService } from '../services/provider.service';
import { KafkaProducerService } from './kafka-producer.service';
import {
  SendMessageParams,
  SendMessageResult,
} from '../provider/interfaces/provider.interface';
import { ConfigService } from '@nestjs/config';

export interface SmsQueueMessage {
  requestId: string;
  appId: string;
  phoneNumbers: string[];
  content: string;
  senderId?: string;
  orderId?: string;
  priority?: number;
  scheduleTime?: string;
  providerId?: string;
  timestamp?: string;
}

@Injectable()
export class SmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);
  private readonly topic: string;

  constructor(
    private readonly kafkaProducer: KafkaProducerService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
  ) {
    this.topic = this.configService.get('kafka.topics.smsRequests');
  }

  async addToQueue(message: SmsQueueMessage): Promise<void> {
    try {
      this.logger.debug(`准备发送消息到主题 ${this.topic}`);
      await this.kafkaProducer.sendMessage(this.topic, [
        {
          ...message,
          timestamp: Date.now(),
        },
      ]);
      this.logger.debug(`消息已加入队列: ${JSON.stringify(message)}`);
    } catch (error) {
      this.logger.error(`加入队列失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async enqueueSmsRequest(message: SmsQueueMessage): Promise<void> {
    try {
      await this.addToQueue(message);
      this.logger.debug(`消息已入队: ${message.requestId}`);
    } catch (error) {
      this.logger.error(`消息入队失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async processMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      return await this.providerService.sendMessage(params);
    } catch (error) {
      this.logger.error(`处理消息失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
