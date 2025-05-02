import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'service_id', length: 32, unique: true })
  @Index()
  serviceId: string;

  @Column({ name: 'service_name', length: 64 })
  serviceName: string;

  @Column({ name: 'api_key', length: 64, unique: true })
  @Index()
  apiKey: string;

  @Column({ name: 'api_secret', length: 128 })
  apiSecret: string;

  @Column({ name: 'status', type: 'smallint', default: 1 })
  @Index()
  status: number;

  @Column({ name: 'sign_type', length: 16, default: 'md5' })
  signType: string;

  @Column({ name: 'sign_key', length: 256, nullable: true })
  signKey: string;

  @Column({ name: 'sign_tolerance', default: 300 })
  signTolerance: number;

  @Column({ name: 'request_limit', default: 1000 })
  requestLimit: number;

  @Column('text', { name: 'ip_whitelist', array: true, nullable: true })
  ipWhitelist: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
