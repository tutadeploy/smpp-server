import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../queue/kafka-producer.service';
import { KafkaConsumerService } from '../queue/kafka-consumer.service';
import { ConfigService } from '@nestjs/config';

export interface KafkaHealthStatus {
  status: 'up' | 'down';
  details: {
    consumers: {
      status: 'up' | 'down';
      lag: number;
      groups: Array<{
        groupId: string;
        lag: number;
        status: 'up' | 'down';
      }>;
    };
    producers: {
      status: 'up' | 'down';
      pendingMessages: number;
    };
    brokers: {
      total: number;
      connected: number;
    };
  };
}

@Injectable()
export class KafkaHealthService {
  private readonly logger = new Logger(KafkaHealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly producerService: KafkaProducerService,
    private readonly consumerService: KafkaConsumerService,
  ) {}

  /**
   * 检查 Kafka 健康状态
   */
  async check(): Promise<KafkaHealthStatus> {
    try {
      const [producerStatus, consumerStatus] = await Promise.all([
        this.checkProducer(),
        this.checkConsumer(),
      ]);

      const status: KafkaHealthStatus = {
        status:
          producerStatus.status === 'up' && consumerStatus.status === 'up'
            ? 'up'
            : 'down',
        details: {
          producers: producerStatus,
          consumers: consumerStatus,
          brokers: await this.checkBrokers(),
        },
      };

      return status;
    } catch (error) {
      this.logger.error(`Kafka健康检查失败: ${error.message}`, error.stack);
      return {
        status: 'down',
        details: {
          consumers: {
            status: 'down',
            lag: -1,
            groups: [],
          },
          producers: {
            status: 'down',
            pendingMessages: -1,
          },
          brokers: {
            total: 0,
            connected: 0,
          },
        },
      };
    }
  }

  /**
   * 检查生产者状态
   */
  private async checkProducer(): Promise<{
    status: 'up' | 'down';
    pendingMessages: number;
  }> {
    try {
      const isConnected = await this.producerService.isConnected();
      const pendingMessages = await this.producerService.getPendingMessages();

      return {
        status: isConnected ? 'up' : 'down',
        pendingMessages,
      };
    } catch (error) {
      this.logger.error(`检查Kafka生产者失败: ${error.message}`, error.stack);
      return {
        status: 'down',
        pendingMessages: -1,
      };
    }
  }

  /**
   * 检查消费者状态
   */
  private async checkConsumer(): Promise<{
    status: 'up' | 'down';
    lag: number;
    groups: Array<{
      groupId: string;
      lag: number;
      status: 'up' | 'down';
    }>;
  }> {
    try {
      const isConnected = await this.consumerService.isConnected();
      const consumerGroups = await this.consumerService.getConsumerGroups();
      const totalLag = consumerGroups.reduce(
        (sum, group) => sum + group.lag,
        0,
      );

      return {
        status: isConnected ? 'up' : 'down',
        lag: totalLag,
        groups: consumerGroups,
      };
    } catch (error) {
      this.logger.error(`检查Kafka消费者失败: ${error.message}`, error.stack);
      return {
        status: 'down',
        lag: -1,
        groups: [],
      };
    }
  }

  /**
   * 检查 Broker 状态
   */
  private async checkBrokers(): Promise<{
    total: number;
    connected: number;
  }> {
    try {
      const brokers = this.configService.get('kafka.brokers', []);
      const connectedBrokers = await this.producerService.getConnectedBrokers();

      return {
        total: brokers.length,
        connected: connectedBrokers,
      };
    } catch (error) {
      this.logger.error(`检查Kafka Broker失败: ${error.message}`, error.stack);
      return {
        total: 0,
        connected: 0,
      };
    }
  }
}
