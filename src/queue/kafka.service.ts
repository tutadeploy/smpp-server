import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);
  private consumerStats: ConsumerStats;
  private producerStats: ProducerStats;
  private brokerStats: BrokerStats;

  constructor(private readonly configService: ConfigService) {
    this.initializeMetrics();
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
    return this.brokerStats.connected > 0;
  }

  async getConsumerStats(): Promise<ConsumerStats> {
    return this.consumerStats;
  }

  async getProducerStats(): Promise<ProducerStats> {
    return this.producerStats;
  }

  async getBrokerStats(): Promise<BrokerStats> {
    return this.brokerStats;
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
