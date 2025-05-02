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
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'provider_id', length: 32, unique: true })
  @Index()
  providerId: string;

  @Column({ name: 'provider_name', length: 64 })
  providerName: string;

  @Column({ length: 128 })
  host: string;

  @Column()
  port: number;

  @Column({ name: 'system_id', length: 64 })
  systemId: string;

  @Column({ length: 128 })
  password: string;

  @Column({ name: 'source_addr', length: 20, nullable: true })
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

  @Column({ type: 'smallint', default: 1 })
  @Index()
  status: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
