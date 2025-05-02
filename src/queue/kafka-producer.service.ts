import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Message, CompressionTypes } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private _isConnected = false;
  private pendingMessages = 0;
  private connectedBrokers = 0;

  constructor(private readonly configService: ConfigService) {
    // 创建Kafka客户端实例
    this.kafka = new Kafka({
      clientId: this.configService.get('kafka.clientId'),
      brokers: this.configService.get('kafka.brokers'),
    });

    // 创建生产者实例
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      // 连接Kafka
      await this.producer.connect();
      this._isConnected = true;
      this.logger.log('Kafka生产者连接成功');
    } catch (error) {
      this.logger.error(`Kafka生产者连接失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this._isConnected) {
      try {
        await this.producer.disconnect();
        this.logger.log('Kafka生产者连接已关闭');
      } catch (error) {
        this.logger.error(
          `Kafka生产者关闭连接失败: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * 发送消息到Kafka队列
   * @param topic 主题名称
   * @param messages 消息数组
   * @returns 发送结果
   */
  async sendMessage(topic: string, messages: any[]): Promise<boolean> {
    try {
      if (!this._isConnected) {
        await this.producer.connect();
        this._isConnected = true;
      }

      // 将消息转换为Kafka消息格式
      const kafkaMessages: Message[] = messages.map((msg) => ({
        value: JSON.stringify(msg),
        timestamp: Date.now().toString(),
      }));

      // 发送消息
      await this.producer.send({
        topic,
        messages: kafkaMessages,
        compression: CompressionTypes.GZIP, // 使用压缩提高性能
      });

      return true;
    } catch (error) {
      this.logger.error(
        `发送消息到Kafka失败 [${topic}]: ${error.message}`,
        error.stack,
      );

      // 尝试重新连接
      if (error.name === 'KafkaJSConnectionError') {
        this._isConnected = false;
        try {
          await this.producer.connect();
          this._isConnected = true;
          this.logger.log('Kafka生产者已重新连接');
        } catch (reconnectError) {
          this.logger.error(
            `Kafka生产者重连失败: ${reconnectError.message}`,
            reconnectError.stack,
          );
        }
      }

      return false;
    }
  }

  async isConnected(): Promise<boolean> {
    return this._isConnected;
  }

  async getPendingMessages(): Promise<number> {
    return this.pendingMessages;
  }

  async getConnectedBrokers(): Promise<number> {
    return this.connectedBrokers;
  }
}
