import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { IKafkaService } from '../../../queue/interfaces/kafka.interface';
import { KAFKA_SERVICE } from '../../../queue/constants';

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(KAFKA_SERVICE)
    private readonly kafkaService: IKafkaService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isConnected = await this.kafkaService.isConnected();
      const brokerStats = await this.kafkaService.getBrokerStats();
      const consumerStats = await this.kafkaService.getConsumerStats();
      const producerStats = await this.kafkaService.getProducerStats();

      const status = {
        status: isConnected,
        brokers: {
          total: brokerStats.total,
          connected: brokerStats.connected,
        },
        consumers: {
          totalLag: consumerStats.totalLag,
        },
        producer: {
          errors: producerStats.errors,
        },
      };

      const result = this.getStatus(key, isConnected, status);

      if (isConnected) {
        return result;
      }

      throw new HealthCheckError('Kafka health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, { message: error.message });
      throw new HealthCheckError('Kafka health check failed', result);
    }
  }
}
