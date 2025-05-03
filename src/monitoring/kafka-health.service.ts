import { Injectable, Logger } from '@nestjs/common';
import { KAFKA_SERVICE } from '../queue/constants';
import { IKafkaService } from '../queue/interfaces/kafka.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class KafkaHealthService {
  private readonly logger = new Logger(KafkaHealthService.name);

  constructor(
    @Inject(KAFKA_SERVICE)
    private readonly kafkaService: IKafkaService,
  ) {}

  async checkKafkaHealth(): Promise<boolean> {
    try {
      const isConnected = await this.kafkaService.isConnected();
      if (!isConnected) {
        this.logger.warn('Kafka connection is not healthy');
        return false;
      }

      const brokerStats = await this.kafkaService.getBrokerStats();
      if (brokerStats.connected === 0) {
        this.logger.warn('No Kafka brokers are connected');
        return false;
      }

      const consumerStats = await this.kafkaService.getConsumerStats();
      if (consumerStats.totalLag > 1000) {
        this.logger.warn(
          `High consumer lag detected: ${consumerStats.totalLag}`,
        );
        return false;
      }

      const producerStats = await this.kafkaService.getProducerStats();
      if (producerStats.errors.length > 0) {
        this.logger.warn(
          `Producer errors detected: ${producerStats.errors.length}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Kafka health check failed: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
