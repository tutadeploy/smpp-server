import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MetricsService } from '../../monitoring/metrics.service';
import { SmsService } from '../../services/sms.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../../entities/message.entity';
import { StatusReport } from '../../entities/status-report.entity';
import { Account } from '../../entities/account.entity';
import { Transaction } from '../../entities/transaction.entity';
import { ProviderModule } from '../../provider/provider.module';
import { QueueModule } from '../../queue/queue.module';
import { MonitoringModule } from '../../monitoring/monitoring.module';
import { ServicesModule } from '../../services/services.module';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { QUEUE_SERVICE } from '../../queue/queue.module';
import { IQueueService } from '../../queue/interfaces/queue.interface';

describe('MessageController (e2e)', () => {
  let app: INestApplication;
  let queueService: IQueueService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'smpp_test',
          entities: [Message, StatusReport, Account, Transaction],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Message, StatusReport, Account, Transaction]),
        ProviderModule,
        QueueModule,
        MonitoringModule,
        ServicesModule,
      ],
      controllers: [MessageController],
      providers: [
        {
          provide: QUEUE_SERVICE,
          useValue: {
            enqueueMessage: jest.fn().mockResolvedValue(undefined),
            processMessage: jest.fn().mockResolvedValue(undefined),
            handleDeadLetter: jest.fn().mockResolvedValue(undefined),
          },
        },
        MetricsService,
        SmsService,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    queueService = module.get<IQueueService>(QUEUE_SERVICE);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/sendSms', () => {
    it('should send SMS successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/sendSms')
        .query({
          appId: 'test-app',
          numbers: '1234567890',
          content: 'Test message',
        })
        .expect(200);

      expect(response.body).toHaveProperty('status', '0');
      expect(response.body).toHaveProperty('success', '1');
      expect(queueService.enqueueMessage).toHaveBeenCalled();
    });

    it('should handle too many phone numbers', async () => {
      const numbers = Array(101).fill('1234567890').join(',');
      const response = await request(app.getHttpServer())
        .get('/api/v1/sendSms')
        .query({
          appId: 'test-app',
          numbers,
          content: 'Test message',
        })
        .expect(400);

      expect(response.body).toHaveProperty('status', '1');
      expect(response.body).toHaveProperty('reason', '号码数量超过限制');
      expect(queueService.enqueueMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/sendSms', () => {
    it('should send SMS successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/sendSms')
        .send({
          appId: 'test-app',
          numbers: '1234567890',
          content: 'Test message',
        })
        .expect(200);

      expect(response.body).toHaveProperty('status', '0');
      expect(response.body).toHaveProperty('success', '1');
      expect(queueService.enqueueMessage).toHaveBeenCalled();
    });

    it('should handle too many phone numbers', async () => {
      const numbers = Array(101).fill('1234567890').join(',');
      const response = await request(app.getHttpServer())
        .post('/api/v1/sendSms')
        .send({
          appId: 'test-app',
          numbers,
          content: 'Test message',
        })
        .expect(400);

      expect(response.body).toHaveProperty('status', '1');
      expect(response.body).toHaveProperty('reason', '号码数量超过限制');
      expect(queueService.enqueueMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/batchSendSms', () => {
    it('should handle batch send successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/batchSendSms')
        .attach('file', Buffer.from('1234567890\n9876543210'), 'numbers.txt')
        .field('appId', 'test-app')
        .field('content', 'Test message')
        .expect(200);

      expect(response.body).toHaveProperty('status', '0');
      expect(response.body).toHaveProperty('success', 2);
      expect(queueService.enqueueMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle empty file', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/batchSendSms')
        .attach('file', Buffer.from(''), 'empty.txt')
        .field('appId', 'test-app')
        .field('content', 'Test message')
        .expect(400);

      expect(response.body).toHaveProperty('status', '1');
      expect(response.body).toHaveProperty('reason', '文件内容为空');
      expect(queueService.enqueueMessage).not.toHaveBeenCalled();
    });
  });
});
