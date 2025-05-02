import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';
import { StatusService } from './status.service';
import { ProviderService } from './provider.service';
import { SmppClientService } from '../provider/smpp-client.service';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { BalanceService } from './balance.service';
import { RecordService } from './record.service';
import { SmsService } from './sms.service';
import { SmsQueueModule } from '../queue/sms-queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Account, Transaction]),
    MonitoringModule,
    forwardRef(() => SmsQueueModule),
  ],
  providers: [
    StatusService,
    ProviderService,
    SmppClientService,
    BalanceService,
    RecordService,
    SmsService,
  ],
  exports: [
    StatusService,
    ProviderService,
    SmppClientService,
    BalanceService,
    RecordService,
    SmsService,
  ],
})
export class ServicesModule {}
