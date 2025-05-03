import { Test, TestingModule } from '@nestjs/testing';
import { StatusController } from './status.controller';
import { ProviderService } from '../../provider/provider.service';
import { SmppClientService } from '../../provider/smpp-client.service';
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

describe('StatusController (e2e)', () => {
  let app: INestApplication;

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
      controllers: [StatusController],
      providers: [ProviderService, SmppClientService],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /status/session', () => {
    it('should return session info', async () => {
      const response = await request(app.getHttpServer())
        .get('/status/session')
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('connected');
    });
  });

  describe('GET /status/bind', () => {
    it('should return bind info', async () => {
      const response = await request(app.getHttpServer())
        .get('/status/bind')
        .expect(200);

      expect(response.body).toHaveProperty('systemId');
      expect(response.body).toHaveProperty('password');
      expect(response.body).toHaveProperty('systemType');
    });
  });

  describe('GET /status/message', () => {
    it('should return message stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/status/message')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('failed');
    });
  });

  describe('GET /status/providers', () => {
    it('should return all providers', async () => {
      const response = await request(app.getHttpServer())
        .get('/status/providers')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('activeProviderId');
      expect(response.body).toHaveProperty('providers');
      expect(Array.isArray(response.body.providers)).toBe(true);
    });
  });

  describe('GET /status/provider/active', () => {
    it('should return active provider', async () => {
      const response = await request(app.getHttpServer())
        .get('/status/provider/active')
        .expect(200);

      expect(response.body).toHaveProperty('activeProviderId');
    });
  });

  describe('POST /status/provider/switch', () => {
    it('should switch provider successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/status/provider/switch')
        .send({ providerId: 'test-provider' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('activeProviderId');
    });

    it('should handle missing providerId', async () => {
      const response = await request(app.getHttpServer())
        .post('/status/provider/switch')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message', '提供商ID不能为空');
    });

    it('should handle invalid provider', async () => {
      const response = await request(app.getHttpServer())
        .post('/status/provider/switch')
        .send({ providerId: 'invalid-provider' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /status/provider/test', () => {
    it('should test all providers', async () => {
      const response = await request(app.getHttpServer())
        .post('/status/provider/test')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      response.body.results.forEach((result: any) => {
        expect(result).toHaveProperty('providerId');
        expect(result).toHaveProperty('connected');
        expect(result).toHaveProperty('isActive');
      });
    });
  });
});
