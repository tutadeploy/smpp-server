import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { KafkaService } from '../../../queue/kafka.service';

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(KafkaHealthIndicator.name);

  constructor(private readonly kafkaService: KafkaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 检查 Kafka 连接状态
      const isConnected = await this.checkKafkaConnection();

      // 检查消费者组状态
      const consumerGroupsStatus = await this.checkConsumerGroups();

      // 检查生产者状态
      const producerStatus = await this.checkProducer();

      // 检查 Broker 状态
      const brokerStatus = await this.checkBrokers();

      const isHealthy =
        isConnected &&
        consumerGroupsStatus.status &&
        producerStatus.status &&
        brokerStatus.connected > 0;

      const result = this.getStatus(key, isHealthy, {
        consumerGroups: consumerGroupsStatus,
        producer: producerStatus,
        brokers: brokerStatus,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Kafka health check failed: ${error.message}`,
        error.stack,
      );
      throw new HealthCheckError(
        'Kafka health check failed',
        this.getStatus(key, false, {
          message: error.message,
          stack: error.stack,
        }),
      );
    }
  }

  private async checkKafkaConnection(): Promise<boolean> {
    try {
      return await this.kafkaService.isConnected();
    } catch (error) {
      this.logger.error(
        `Failed to check Kafka connection: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private async checkConsumerGroups(): Promise<{
    status: boolean;
    details: Record<string, any>;
  }> {
    try {
      const consumerStats = await this.kafkaService.getConsumerStats();

      return {
        status: consumerStats.activeConsumers > 0,
        details: {
          activeConsumers: consumerStats.activeConsumers,
          totalLag: consumerStats.totalLag,
          groups: consumerStats.groups.map((group) => ({
            groupId: group.groupId,
            lag: group.lag,
            status: group.status,
            members: group.members,
            topics: group.topics,
          })),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to check consumer groups: ${error.message}`,
        error.stack,
      );
      return {
        status: false,
        details: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }

  private async checkProducer(): Promise<{
    status: boolean;
    details: Record<string, any>;
  }> {
    try {
      const producerStats = await this.kafkaService.getProducerStats();

      return {
        status: producerStats.isConnected,
        details: {
          connected: producerStats.isConnected,
          lastMessageSentAt: producerStats.lastMessageSentAt,
          pendingMessages: producerStats.pendingMessages,
          messagesSentLast5Minutes: producerStats.messagesSentLast5Minutes,
          averageLatency: producerStats.averageLatency,
          errors: producerStats.errors,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to check producer: ${error.message}`,
        error.stack,
      );
      return {
        status: false,
        details: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }

  private async checkBrokers(): Promise<{
    total: number;
    connected: number;
    details?: Record<string, any>;
  }> {
    try {
      const brokerStats = await this.kafkaService.getBrokerStats();

      return {
        total: brokerStats.total,
        connected: brokerStats.connected,
        details: {
          brokers: brokerStats.brokers.map((broker) => ({
            id: broker.id,
            host: broker.host,
            port: broker.port,
            connected: broker.connected,
            lastHeartbeat: broker.lastHeartbeat,
          })),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to check brokers: ${error.message}`,
        error.stack,
      );
      return {
        total: 0,
        connected: 0,
        details: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }
}
