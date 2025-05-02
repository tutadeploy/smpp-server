import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';

export type TransactionType = 'RECHARGE' | 'DEDUCT' | 'REFUND' | 'GIFT';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ name: 'app_id', length: 64 })
  appId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  @Column({
    name: 'credit_used',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  creditUsed: number;

  @Column({
    name: 'credit_used_after',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  creditUsedAfter: number;

  @Column({
    type: 'enum',
    enum: ['RECHARGE', 'DEDUCT', 'REFUND', 'GIFT'],
  })
  type: TransactionType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
