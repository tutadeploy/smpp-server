import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { ProviderModule } from '../provider/provider.module';
import { QueueModule } from './queue.module';
import { SmsQueueService } from './services/sms-queue.service';
import { SmsQueueConsumerService } from './services/sms-queue-consumer.service';
import { SMS_QUEUE_SERVICE } from './sms-queue.constants';
import { ConfigModule } from '@nestjs/config';
import { MonitoringModule } from '../monitoring/monitoring.module';

/**
 * 短信队列模块
 * 负责处理短信发送队列的业务逻辑
 */
@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([Message, StatusReport]),
    ProviderModule,
    ConfigModule,
    MonitoringModule,
  ],
  providers: [
    {
      provide: SMS_QUEUE_SERVICE,
      useClass: SmsQueueService,
    },
    SmsQueueConsumerService,
  ],
  exports: [SMS_QUEUE_SERVICE],
})
export class SmsQueueModule {}
