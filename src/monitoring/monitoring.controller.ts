import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HealthService } from './health/health.service';
import { HealthCheck } from '@nestjs/terminus';

@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('health')
  @HealthCheck()
  async check() {
    return this.healthService.check();
  }

  @Get('health/smpp')
  @HealthCheck()
  async checkSmpp() {
    return this.healthService.checkSmppConnection();
  }

  @Get('health/database')
  @HealthCheck()
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('health/kafka')
  @HealthCheck()
  async checkKafka() {
    return this.healthService.checkKafka();
  }
}
