import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from './account.entity';

export enum MessageStatusEnum {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
  PROCESSING = 'PROCESSING',
  EXPIRED = 'EXPIRED',
}

export type MessageStatus = MessageStatusEnum;

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', length: 64, unique: true })
  @Index()
  messageId: string;

  @Column({ name: 'app_id', length: 64 })
  appId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'app_id', referencedColumnName: 'appId' })
  account: Account;

  @Column({ length: 20 })
  phoneNumber: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'sender_id', length: 32, nullable: true })
  senderId?: string;

  @Column({ name: 'order_id', length: 64, nullable: true })
  orderId?: string;

  @Column({ name: 'provider_message_id', length: 64, nullable: true })
  providerMessageId?: string;

  @Column({
    type: 'enum',
    enum: MessageStatusEnum,
    default: MessageStatusEnum.PENDING,
  })
  status: MessageStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'priority', default: 1 })
  priority: number;

  @Column({ name: 'schedule_time', type: 'timestamp', nullable: true })
  scheduleTime?: Date;

  @Column({ name: 'send_time', type: 'timestamp', nullable: true })
  sendTime?: Date;

  @Column({ name: 'update_time', type: 'timestamp', nullable: true })
  updateTime?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
