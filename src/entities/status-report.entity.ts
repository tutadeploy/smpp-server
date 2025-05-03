import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';
import {
  ProviderStatusEnum,
  ProviderStatus,
} from '../provider/interfaces/provider.interface';

@Entity('status_reports')
export class StatusReport {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'message_id', length: 36 })
  @Index()
  messageId: string;

  @Column({ name: 'phone_number', length: 32 })
  phoneNumber: string;

  @Column({ name: 'provider_id', length: 32 })
  providerId: string;

  @Column({ name: 'provider_message_id', length: 64 })
  @Index()
  providerMessageId: string;

  @Column({
    type: 'enum',
    enum: ProviderStatusEnum,
    default: ProviderStatusEnum.PENDING,
  })
  @Index()
  status: ProviderStatus;

  @Column({ name: 'error_code', length: 20, nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  @Index()
  deliveredAt: Date;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'raw_data', type: 'text', nullable: true })
  rawData: string;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'message_id', referencedColumnName: 'messageId' })
  message: Message;
}
