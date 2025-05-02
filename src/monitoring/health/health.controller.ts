import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { KafkaHealthIndicator } from './indicators/kafka.health';
import { SmppHealthIndicator } from './indicators/smpp.health';
import { DatabaseHealthIndicator } from './indicators/database.health';

@Controller('monitoring/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private kafka: KafkaHealthIndicator,
    private smpp: SmppHealthIndicator,
    private database: DatabaseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // 系统健康检查
      () => this.http.pingCheck('api', 'http://localhost:3000/api'),

      // 数据库健康检查
      () => this.database.isHealthy('database'),

      // Kafka健康检查
      () => this.kafka.isHealthy('kafka'),

      // SMPP连接健康检查
      () => this.smpp.isHealthy('smpp'),
    ]);
  }

  @Get('kafka')
  @HealthCheck()
  async checkKafka(): Promise<HealthCheckResult> {
    return this.health.check([() => this.kafka.isHealthy('kafka')]);
  }

  @Get('smpp')
  @HealthCheck()
  async checkSmpp(): Promise<HealthCheckResult> {
    return this.health.check([() => this.smpp.isHealthy('smpp')]);
  }

  @Get('database')
  @HealthCheck()
  async checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}
