import { Module } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';
import { MetricsService } from './metrics/metrics.service';

@Module({
  providers: [LoggerService, MetricsService],
  exports: [LoggerService, MetricsService],
})
export class CommonModule {}
