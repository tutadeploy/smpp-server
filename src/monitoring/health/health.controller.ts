import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheck, HealthCheckResult } from '@nestjs/terminus';

@ApiTags('监控')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check();
  }

  @Get('db')
  @HealthCheck()
  checkDb(): Promise<HealthCheckResult> {
    return this.health.checkDatabase();
  }

  @Get('smpp')
  @HealthCheck()
  checkSmpp(): Promise<HealthCheckResult> {
    return this.health.checkSmppConnection();
  }

  @Get('kafka')
  @HealthCheck()
  checkKafka(): Promise<HealthCheckResult> {
    return this.health.checkKafka();
  }
}
