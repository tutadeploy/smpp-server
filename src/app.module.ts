import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { ServicesModule } from './services/services.module';
import { QueueModule } from './queue/queue.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LoggerModule } from './common/logger/logger.module';
import { ApiModule } from './api/api.module';
import configuration from './config/configuration';
import { Utf8QueryMiddleware } from './common/middleware/utf8-query.middleware';
import { AuthModule } from './auth/auth.module';
import { ProviderModule } from './provider/provider.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      expandVariables: true,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        return {
          ...dbConfig,
          logging: false,
          maxQueryExecutionTime: 0,
        };
      },
    }),
    HttpModule,
    TerminusModule,
    LoggerModule,
    QueueModule,
    ProviderModule,
    MonitoringModule,
    ServicesModule,
    AuthModule,
    ApiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(Utf8QueryMiddleware).forRoutes('*');
  }
}
