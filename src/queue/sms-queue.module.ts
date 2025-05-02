import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsQueueService } from './sms-queue.service';
import { SmsQueueConsumer } from './sms-queue.consumer';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { ServicesModule } from '../services/services.module';
import { BalanceService } from '../services/balance.service';
import { Account } from '../entities/account.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ServicesModule),
    TypeOrmModule.forFeature([Account, Transaction]),
  ],
  providers: [
    KafkaProducerService,
    KafkaConsumerService,
    SmsQueueService,
    SmsQueueConsumer,
    BalanceService,
  ],
  exports: [SmsQueueService],
})
export class SmsQueueModule {}
