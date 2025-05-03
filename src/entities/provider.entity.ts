import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'provider_id', unique: true })
  @Index()
  providerId: string;

  @Column({ name: 'provider_name' })
  providerName: string;

  @Column()
  host: string;

  @Column()
  port: number;

  @Column({ name: 'system_id' })
  systemId: string;

  @Column()
  password: string;

  @Column({ name: 'source_addr', nullable: true })
  sourceAddr: string;

  @Column({ name: 'connect_timeout', default: 30000 })
  connectTimeout: number;

  @Column({ name: 'request_timeout', default: 45000 })
  requestTimeout: number;

  @Column({ name: 'reconnect_interval', default: 10000 })
  reconnectInterval: number;

  @Column({ name: 'max_reconnect_attempts', default: 3 })
  maxReconnectAttempts: number;

  @Column({ default: 10 })
  priority: number;

  @Column({ default: 100 })
  weight: number;

  @Column({ default: 1 })
  @Index()
  status: number;

  @Column({ name: 'system_type', nullable: true })
  systemType: string;

  @Column({ name: 'max_connections', default: 5 })
  maxConnections: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
