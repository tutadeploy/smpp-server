import { Module } from '@nestjs/common';
import { MessageController } from './controllers/message.controller';
import { StatusController } from './controllers/status.controller';
import { AccountController } from './controllers/account.controller';
import { RecordController } from './controllers/record.controller';
import { SmsQueueModule } from '../queue/sms-queue.module';
import { ServicesModule } from '../services/services.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SmsQueueModule, ServicesModule, MonitoringModule, AuthModule],
  controllers: [
    MessageController,
    StatusController,
    AccountController,
    RecordController,
  ],
})
export class ApiModule {}
