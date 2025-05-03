import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { KafkaService } from './kafka.service';
import { QueueService } from './queue.service';
import { DeadLetterService } from './dead-letter.service';
import { METRICS_SERVICE } from '../provider/interfaces/metrics.interface';
import { KAFKA_SERVICE, QUEUE_SERVICE, DEAD_LETTER_SERVICE } from './constants';

// 空的指标服务实现，用于解决循环依赖
class NullMetricsService {
  /**
   * 空实现，用于解决循环依赖
   */
  incrementCounter(): void {
    // 空实现，用于占位
  }

  /**
   * 空实现，用于解决循环依赖
   */
  recordHistogram(): void {
    // 空实现，用于占位
  }

  /**
   * 空实现，用于解决循环依赖
   */
  recordGauge(): void {
    // 空实现，用于占位
  }
}

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Message, StatusReport])],
  providers: [
    {
      provide: KAFKA_SERVICE,
      useClass: KafkaService,
    },
    {
      provide: QUEUE_SERVICE,
      useClass: QueueService,
    },
    {
      provide: DEAD_LETTER_SERVICE,
      useClass: DeadLetterService,
    },
    // 提供一个空的指标服务实现，以解决循环依赖
    {
      provide: METRICS_SERVICE,
      useClass: NullMetricsService,
    },
  ],
  exports: [KAFKA_SERVICE, QUEUE_SERVICE, DEAD_LETTER_SERVICE, METRICS_SERVICE],
})
export class QueueModule {}
