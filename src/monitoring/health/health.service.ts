import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheckResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { SmppHealthIndicator } from './indicators/smpp.health';
import { KafkaHealthIndicator } from './indicators/kafka.health';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private smppHealth: SmppHealthIndicator,
    private kafkaHealth: KafkaHealthIndicator,
    @InjectConnection() private connection: Connection,
  ) {}

  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { connection: this.connection }),
      () => this.smppHealth.isHealthy('smpp'),
      () => this.kafkaHealth.isHealthy('kafka'),
    ]);
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { connection: this.connection }),
    ]);
  }

  async checkSmppConnection(): Promise<HealthCheckResult> {
    return this.health.check([() => this.smppHealth.isHealthy('smpp')]);
  }

  async checkKafka(): Promise<HealthCheckResult> {
    return this.health.check([() => this.kafkaHealth.isHealthy('kafka')]);
  }
}
