import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from './services/services.module';
import { QueueModule } from './queue/queue.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LoggerModule } from './common/logger/logger.module';
import { ApiModule } from './api/api.module';
import configuration from './config/configuration';
import appConfig from './config/app.config';
import { Service } from './entities/service.entity';
import { Account } from './entities/account.entity';
import { Message } from './entities/message.entity';
import { StatusReport } from './entities/status-report.entity';
import { Provider } from './entities/provider.entity';
import { Transaction } from './entities/transaction.entity';
import { Utf8QueryMiddleware } from './common/middleware/utf8-query.middleware';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, appConfig],
      envFilePath: ['.env'],
      expandVariables: true,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'admin'),
        password: configService.get('DB_PASSWORD', 'admin123'),
        database: configService.get('DB_DATABASE', 'sms_serve'),
        entities: [
          Service,
          Account,
          Message,
          StatusReport,
          Provider,
          Transaction,
        ],
        synchronize: configService.get('DB_SYNCHRONIZE', true),
        logging: configService.get('NODE_ENV') === 'development',
        maxQueryExecutionTime: 1000,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
    ServicesModule,
    QueueModule,
    MonitoringModule,
    ApiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(Utf8QueryMiddleware).forRoutes('*');
  }
}
