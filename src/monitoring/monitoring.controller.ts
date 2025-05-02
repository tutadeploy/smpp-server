import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { KafkaHealthIndicator } from './health/indicators/kafka.health';
import { SmppHealthIndicator } from './health/indicators/smpp.health';
import { DatabaseHealthIndicator } from './health/indicators/database.health';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly kafka: KafkaHealthIndicator,
    private readonly smpp: SmppHealthIndicator,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }

  @Get('health')
  @HealthCheck()
  async check() {
    return this.health.check([
      // 数据库健康检查
      () => this.database.isHealthy('database'),

      // 内存使用检查
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB

      // Kafka 健康检查
      () => this.kafka.isHealthy('kafka'),

      // SMPP 健康检查
      () => this.smpp.isHealthy('smpp'),
    ]);
  }

  @Get('health/kafka')
  @HealthCheck()
  async checkKafka() {
    return this.health.check([() => this.kafka.isHealthy('kafka')]);
  }

  @Get('health/smpp')
  @HealthCheck()
  async checkSmpp() {
    return this.health.check([() => this.smpp.isHealthy('smpp')]);
  }

  @Get('health/database')
  @HealthCheck()
  async checkDatabase() {
    return this.health.check([() => this.database.isHealthy('database')]);
  }

  @Get('health/memory')
  @HealthCheck()
  async checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }
}
