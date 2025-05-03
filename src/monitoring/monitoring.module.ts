import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';
import { SmppHealthIndicator } from './health/indicators/smpp.health';
import { DatabaseHealthIndicator } from './health/indicators/database.health';
import { StatusReport } from '../entities/status-report.entity';
import { Message } from '../entities/message.entity';
import { ProviderModule } from '../provider/provider.module';
import { QueueModule } from '../queue/queue.module';
import { HealthService } from './health/health.service';
import { METRICS_SERVICE } from '../provider/interfaces/metrics.interface';
import { KafkaHealthIndicator } from './health/indicators/kafka.health';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    TypeOrmModule.forFeature([StatusReport, Message]),
    ConfigModule,
    ProviderModule,
    QueueModule,
  ],
  controllers: [MonitoringController],
  providers: [
    {
      provide: METRICS_SERVICE,
      useClass: MetricsService,
    },
    MetricsService,
    HealthService,
    SmppHealthIndicator,
    DatabaseHealthIndicator,
    KafkaHealthIndicator,
  ],
  exports: [MetricsService, METRICS_SERVICE],
})
export class MonitoringModule {}
