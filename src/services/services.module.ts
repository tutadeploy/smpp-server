import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { StatusReport } from '../entities/status-report.entity';
import { StatusService } from './status.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { BalanceService } from './balance.service';
import { RecordService } from './record.service';
import { SmsService } from './sms.service';
import { ProviderModule } from '../provider/provider.module';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import {
  SMS_SERVICE,
  BALANCE_SERVICE,
  STATUS_SERVICE,
  RECORD_SERVICE,
} from './services.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Account, Transaction, StatusReport]),
    MonitoringModule,
    ProviderModule,
    ConfigModule,
    QueueModule,
  ],
  providers: [
    {
      provide: SMS_SERVICE,
      useClass: SmsService,
    },
    {
      provide: BALANCE_SERVICE,
      useClass: BalanceService,
    },
    {
      provide: STATUS_SERVICE,
      useClass: StatusService,
    },
    {
      provide: RECORD_SERVICE,
      useClass: RecordService,
    },
  ],
  exports: [SMS_SERVICE, BALANCE_SERVICE, STATUS_SERVICE, RECORD_SERVICE],
})
export class ServicesModule {}
