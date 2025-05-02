import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';
import { KafkaHealthIndicator } from './health/indicators/kafka.health';
import { SmppHealthIndicator } from './health/indicators/smpp.health';
import { DatabaseHealthIndicator } from './health/indicators/database.health';
import { KafkaService } from '../queue/kafka.service';
import { SmppService } from '../provider/smpp.service';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    TypeOrmModule.forFeature([]),
    ConfigModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MetricsService,
    KafkaHealthIndicator,
    SmppHealthIndicator,
    DatabaseHealthIndicator,
    KafkaService,
    SmppService,
  ],
  exports: [MetricsService],
})
export class MonitoringModule {}
