import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Service } from './service.entity';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'app_id', length: 64, unique: true })
  appId: string;

  @Column({ name: 'app_name', length: 128 })
  appName: string;

  @Column({ name: 'service_id', length: 32 })
  serviceId: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id', referencedColumnName: 'serviceId' })
  service: Service;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({
    name: 'gift_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  giftBalance: number;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  creditLimit: number;

  @Column({
    name: 'credit_used',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  creditUsed: number;

  @Column({ name: 'daily_limit', type: 'integer', default: 10000 })
  dailyLimit: number;

  @Column({ name: 'monthly_limit', type: 'integer', default: 300000 })
  monthlyLimit: number;

  @Column({ length: 32, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'api_key', length: 64, nullable: true })
  apiKey: string;

  @Column({ name: 'is_active', default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
