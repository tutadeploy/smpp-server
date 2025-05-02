import { Module } from '@nestjs/common';
import { SmsQueueModule } from './sms-queue.module';

@Module({
  imports: [SmsQueueModule],
  exports: [SmsQueueModule],
})
export class QueueModule {}
