import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './common/logger/logger.service';
import { ResponseTransformerInterceptor } from './api/interceptors/response-transformer.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const loggerService = app.get(LoggerService);

  // 全局验证管道
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 全局日志服务
  app.useGlobalInterceptors(new ResponseTransformerInterceptor(loggerService));

  // 使用log方法替代info方法
  loggerService.log('NestJS 应用程序正在启动...');

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
  loggerService.log(`正在尝试使用端口: ${port}`);

  await app.listen(port);

  loggerService.log(`SMPP服务已启动，运行在端口: ${await app.getUrl()}`);
}

void bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
