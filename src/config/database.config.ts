import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { Service } from '../entities/service.entity';
import { Account } from '../entities/account.entity';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { Provider } from '../entities/provider.entity';

export default registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_DATABASE || 'sms_serve',
    entities: [Service, Account, Message, StatusReport, Provider],
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.NODE_ENV === 'development',
    maxQueryExecutionTime: 1000, // 记录执行时间超过1秒的查询
    ssl: process.env.DB_SSL === 'true',
    extra: {
      max: 20, // 连接池最大连接数
      idleTimeoutMillis: 30000, // 空闲连接超时时间
      connectionTimeoutMillis: 2000, // 连接超时时间
    },
  }),
);
