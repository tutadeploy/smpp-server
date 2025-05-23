import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './common/logger/logger.service';
import { ResponseTransformerInterceptor } from './api/interceptors/response-transformer.interceptor';

// 禁用 KafkaJS 所有日志
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
// 禁用 KafkaJS 信息日志
process.env.KAFKAJS_LOG_LEVEL = 'NOTHING';
// 完全禁用 KafkaJS 日志
process.env.DISABLE_KAFKAJS_LOGGER = 'true';

async function bootstrap() {
  // 添加环境变量调试信息
  console.log('======= 环境变量调试 =======');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DB_HOST直接读取: ${process.env.DB_HOST}`);
  console.log(`DB_DATABASE直接读取: ${process.env.DB_DATABASE}`);
  console.log(`SMPP_HOST直接读取: ${process.env.SMPP_HOST}`);
  console.log('===========================');

  const app = await NestFactory.create(AppModule, {
    // 启用NestJS默认日志
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const loggerService = app.get(LoggerService);

  // 同时使用自定义日志服务记录到文件
  app.useLogger(loggerService);

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 全局日志服务
  app.useGlobalInterceptors(new ResponseTransformerInterceptor(loggerService));

  // Swagger文档
  const config = new DocumentBuilder()
    .setTitle('SMPP Service API')
    .setDescription('SMPP短信服务API文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = configService.get<number>('app.port', 13000);
  await app.listen(port);

  const dbHost = configService.get('database.host');
  const dbPort = configService.get('database.port');
  const dbName = configService.get('database.database');
  console.log(`[启动信息] 数据库连接: ${dbHost}:${dbPort} / ${dbName}`);

  console.log(`SMPP服务已启动，运行在端口: ${port}`);
  loggerService.log(`SMPP服务已启动，运行在端口: ${await app.getUrl()}`);
}

void bootstrap().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
