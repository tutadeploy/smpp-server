import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, EachMessagePayload, Producer } from 'kafkajs';
import {
  IMetricsService,
  METRICS_SERVICE,
} from '../provider/interfaces/metrics.interface';
import { IKafkaService } from './interfaces/kafka.interface';

export interface ConsumerGroupStats {
  groupId: string;
  lag: number;
  status: 'up' | 'down';
  members: number;
  topics: string[];
}

export interface ConsumerStats {
  activeConsumers: number;
  totalLag: number;
  groups: ConsumerGroupStats[];
}

export interface ProducerStats {
  isConnected: boolean;
  lastMessageSentAt: Date;
  pendingMessages: number;
  messagesSentLast5Minutes: number;
  averageLatency: number;
  errors: Array<{
    code: string;
    message: string;
    timestamp: Date;
  }>;
}

export interface BrokerInfo {
  id: number;
  host: string;
  port: number;
  connected: boolean;
  lastHeartbeat: Date;
}

export interface BrokerStats {
  total: number;
  connected: number;
  brokers: BrokerInfo[];
}

@Injectable()
export class KafkaService
  implements IKafkaService, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private messageHandlers: Map<string, (message: any) => Promise<void>> =
    new Map();
  private consumerStats: ConsumerStats;
  private producerStats: ProducerStats;
  private brokerStats: BrokerStats;

  constructor(
    private readonly configService: ConfigService,
    @Inject(METRICS_SERVICE)
    private readonly metricsService: IMetricsService,
  ) {
    const brokers = this.configService.get<string[]>('kafka.brokers') || [
      'localhost:9092',
    ];
    const clientId =
      this.configService.get<string>('kafka.clientId') || 'sms-service';

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId: this.configService.get<string>('kafka.groupId') || 'sms-group',
    });

    this.initializeMetrics();
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([this.producer.connect(), this.consumer.connect()]);
      this.logger.log('Kafka connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Kafka: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.producer.disconnect(),
        this.consumer.disconnect(),
      ]);
      this.logger.log('Kafka disconnected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to disconnect from Kafka: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getBrokerInfo(): Promise<BrokerInfo[]> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.describeCluster();
      await admin.disconnect();

      return metadata.brokers.map((broker) => ({
        id: broker.nodeId,
        host: broker.host,
        port: broker.port,
        connected: true,
        lastHeartbeat: new Date(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get broker info: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendMessage(
    topic: string,
    messages: Array<{ key: string; value: string }>,
  ): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: messages.map((msg) => ({
          key: msg.key,
          value: msg.value,
          timestamp: Date.now().toString(),
        })),
      });
      this.metricsService.incrementCounter('kafka_messages_sent', { topic });
    } catch (error) {
      this.logger.error(
        `Failed to send message: ${error.message}`,
        error.stack,
      );
      this.metricsService.incrementCounter('kafka_messages_error', { topic });
      throw error;
    }
  }

  async registerHandler(
    topic: string,
    handler: (message: any) => Promise<void>,
  ): Promise<void> {
    try {
      if (this.messageHandlers.has(topic)) {
        throw new Error(`Handler already registered for topic: ${topic}`);
      }

      this.messageHandlers.set(topic, handler);
      await this.consumer.subscribe({ topic, fromBeginning: true });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            const message = JSON.parse(
              payload.message.value?.toString() || '{}',
            );
            const handler = this.messageHandlers.get(topic);
            if (handler) {
              await handler(message);
              this.metricsService.incrementCounter('kafka_messages_processed', {
                topic,
              });
            }
          } catch (error) {
            this.logger.error(
              `Failed to process message: ${error.message}`,
              error.stack,
            );
            this.metricsService.incrementCounter('kafka_messages_error', {
              topic,
            });
          }
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to register handler: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeHandler(topic: string): Promise<void> {
    try {
      this.messageHandlers.delete(topic);
      await this.consumer.stop();
      this.logger.log(`Handler removed for topic: ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove handler: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private initializeMetrics(): void {
    this.consumerStats = {
      activeConsumers: 0,
      totalLag: 0,
      groups: [],
    };

    this.producerStats = {
      isConnected: false,
      lastMessageSentAt: null,
      pendingMessages: 0,
      messagesSentLast5Minutes: 0,
      averageLatency: 0,
      errors: [],
    };

    const brokers = this.configService.get<string[]>('kafka.brokers', []);
    this.brokerStats = {
      total: brokers.length,
      connected: 0,
      brokers: brokers.map((broker, index) => {
        const [host, port] = broker.split(':');
        return {
          id: index + 1,
          host,
          port: parseInt(port, 10),
          connected: false,
          lastHeartbeat: null,
        };
      }),
    };
  }

  async isConnected(): Promise<boolean> {
    try {
      await Promise.all([this.producer.connect(), this.consumer.connect()]);
      return true;
    } catch (error) {
      this.logger.error(`Failed to check connection status: ${error.message}`);
      return false;
    }
  }

  async getBrokerStats(): Promise<{ total: number; connected: number }> {
    const brokers = await this.getBrokerInfo();
    return {
      total: brokers.length,
      connected: brokers.filter((b) => b.connected).length,
    };
  }

  async getConsumerStats(): Promise<{ totalLag: number }> {
    const stats = this.consumerStats;
    return {
      totalLag: stats.totalLag,
    };
  }

  async getProducerStats(): Promise<{ errors: string[] }> {
    const stats = this.producerStats;
    return {
      errors: stats.errors.map((e) => e.message),
    };
  }

  // 更新消费者组统计信息
  updateConsumerStats(stats: Partial<ConsumerStats>): void {
    this.consumerStats = {
      ...this.consumerStats,
      ...stats,
    };
  }

  // 更新生产者统计信息
  updateProducerStats(stats: Partial<ProducerStats>): void {
    this.producerStats = {
      ...this.producerStats,
      ...stats,
    };
  }

  // 更新 Broker 统计信息
  updateBrokerStats(stats: Partial<BrokerStats>): void {
    this.brokerStats = {
      ...this.brokerStats,
      ...stats,
    };
  }

  // 更新特定 Broker 的状态
  updateBrokerStatus(brokerId: number, connected: boolean): void {
    const broker = this.brokerStats.brokers.find((b) => b.id === brokerId);
    if (broker) {
      broker.connected = connected;
      broker.lastHeartbeat = connected ? new Date() : broker.lastHeartbeat;
      this.brokerStats.connected = this.brokerStats.brokers.filter(
        (b) => b.connected,
      ).length;
    }
  }

  // 添加生产者错误记录
  addProducerError(code: string, message: string): void {
    this.producerStats.errors.push({
      code,
      message,
      timestamp: new Date(),
    });

    // 保持最近的100条错误记录
    if (this.producerStats.errors.length > 100) {
      this.producerStats.errors.shift();
    }
  }

  // 更新消费者组信息
  updateConsumerGroup(groupStats: ConsumerGroupStats): void {
    const existingGroupIndex = this.consumerStats.groups.findIndex(
      (g) => g.groupId === groupStats.groupId,
    );

    if (existingGroupIndex >= 0) {
      this.consumerStats.groups[existingGroupIndex] = groupStats;
    } else {
      this.consumerStats.groups.push(groupStats);
    }

    // 更新总体统计信息
    this.consumerStats.activeConsumers = this.consumerStats.groups.reduce(
      (sum, group) => sum + group.members,
      0,
    );
    this.consumerStats.totalLag = this.consumerStats.groups.reduce(
      (sum, group) => sum + group.lag,
      0,
    );
  }
}
