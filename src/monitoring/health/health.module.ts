import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { KafkaHealthIndicator } from './indicators/kafka.health';
import { SmppHealthIndicator } from './indicators/smpp.health';
import { DatabaseHealthIndicator } from './indicators/database.health';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [
    KafkaHealthIndicator,
    SmppHealthIndicator,
    DatabaseHealthIndicator,
  ],
})
export class HealthModule {}
