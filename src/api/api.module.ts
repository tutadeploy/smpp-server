import { Module } from '@nestjs/common';
import { MessageController } from './controllers/message.controller';
import { StatusController } from './controllers/status.controller';
import { AccountController } from './controllers/account.controller';
import { RecordController } from './controllers/record.controller';
import { SmsQueueModule } from '../queue/sms-queue.module';
import { ServicesModule } from '../services/services.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '../entities/provider.entity';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { QueueModule } from '../queue/queue.module';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [
    ProviderModule,
    QueueModule,
    SmsQueueModule,
    ServicesModule,
    MonitoringModule,
    AuthModule,
    TypeOrmModule.forFeature([Provider, Message, StatusReport]),
  ],
  controllers: [
    MessageController,
    StatusController,
    AccountController,
    RecordController,
  ],
})
export class ApiModule {}
