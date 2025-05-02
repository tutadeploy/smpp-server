import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly handlers = new Map<
    string,
    (message: any) => Promise<void>
  >();
  private _isConnected = false;

  constructor(private readonly configService: ConfigService) {
    // 创建Kafka客户端实例
    this.kafka = new Kafka({
      clientId: this.configService.get('kafka.clientId'),
      brokers: this.configService.get('kafka.brokers'),
    });

    // 创建消费者实例
    this.consumer = this.kafka.consumer({
      groupId: this.configService.get('kafka.groupId'),
      sessionTimeout: this.configService.get(
        'kafka.consumer.sessionTimeoutMs',
        30000,
      ),
      heartbeatInterval: this.configService.get(
        'kafka.consumer.heartbeatIntervalMs',
        3000,
      ),
    });
  }

  async onModuleInit() {
    try {
      // 连接Kafka
      await this.consumer.connect();
      this._isConnected = true;
      this.logger.log('Kafka消费者连接成功');

      // 订阅配置的主题
      const smsRequestTopic = this.configService.get(
        'kafka.topics.smsRequests',
      );
      await this.consumer.subscribe({
        topic: smsRequestTopic,
        fromBeginning: false, // 仅消费新消息
      });

      // 开始消费消息
      await this.startConsumer();
    } catch (error) {
      this.logger.error(`Kafka消费者初始化失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this._isConnected) {
      try {
        await this.consumer.disconnect();
        this.logger.log('Kafka消费者连接已关闭');
      } catch (error) {
        this.logger.error(
          `Kafka消费者关闭连接失败: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * 注册消息处理器
   * @param topic 主题名称
   * @param handler 处理函数
   */
  registerHandler(
    topic: string,
    handler: (message: any) => Promise<void>,
  ): void {
    this.handlers.set(topic, handler);
  }

  /**
   * 启动消费者
   */
  private async startConsumer(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const { topic, message } = payload;
          const handler = this.handlers.get(topic);

          if (!handler) {
            this.logger.warn(`未找到主题 ${topic} 的处理器`);
            return;
          }

          try {
            // 解析消息
            const messageValue = message.value.toString();
            const parsedMessage = JSON.parse(messageValue);

            // 调用处理器处理消息
            await handler(parsedMessage);
          } catch (error) {
            this.logger.error(
              `处理消息失败 [${topic}]: ${error.message}`,
              error.stack,
            );
          }
        },
      });

      this.logger.log('Kafka消费者开始运行');
    } catch (error) {
      this.logger.error(`启动Kafka消费者失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    return this._isConnected;
  }

  async getConsumerGroups(): Promise<
    Array<{
      groupId: string;
      lag: number;
      status: 'up' | 'down';
    }>
  > {
    // 这里应该实现实际的消费者组状态检查逻辑
    return [
      {
        groupId: 'default-group',
        lag: 0,
        status: 'up',
      },
    ];
  }
}
