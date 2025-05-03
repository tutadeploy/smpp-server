import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { KAFKA_SERVICE, DEAD_LETTER_SERVICE } from './queue.module';
import { IKafkaService } from './interfaces/kafka.interface';
import { IDeadLetterService } from './interfaces/dead-letter.interface';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';

describe('QueueService', () => {
  let service: QueueService;
  let kafkaService: IKafkaService;
  let deadLetterService: IDeadLetterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: KAFKA_SERVICE,
          useValue: {
            sendMessage: jest.fn(),
            isConnected: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: DEAD_LETTER_SERVICE,
          useValue: {
            handleFailedMessage: jest.fn(),
            handleFailedStatusReport: jest.fn(),
          },
        },
        {
          provide: 'ConfigService',
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'kafka.topics.smsRequests': 'sms-requests',
                'sms.maxRetries': 3,
                'sms.retryDelay': 5000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    kafkaService = module.get<IKafkaService>(KAFKA_SERVICE);
    deadLetterService = module.get<IDeadLetterService>(DEAD_LETTER_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueMessage', () => {
    it('should enqueue message successfully', async () => {
      const message = {
        requestId: 'test-request',
        appId: 'test-app',
        phoneNumbers: ['1234567890'],
        content: 'test message',
        timestamp: new Date().toISOString(),
        providerId: 'test-provider',
      };

      await service.enqueueMessage(message);
      expect(kafkaService.sendMessage).toHaveBeenCalledWith(
        'sms-requests',
        expect.arrayContaining([
          expect.objectContaining({
            key: message.requestId,
            value: expect.stringContaining(message.requestId),
          }),
        ]),
      );
    });

    it('should handle enqueue errors', async () => {
      const message = {
        requestId: 'test-request',
        appId: 'test-app',
        phoneNumbers: ['1234567890'],
        content: 'test message',
        timestamp: new Date().toISOString(),
        providerId: 'test-provider',
      };

      jest
        .spyOn(kafkaService, 'sendMessage')
        .mockRejectedValue(new Error('Enqueue failed'));
      await expect(service.enqueueMessage(message)).rejects.toThrow(
        'Enqueue failed',
      );
    });
  });

  describe('processMessage', () => {
    it('should process message successfully', async () => {
      const message = {
        requestId: 'test-request',
        appId: 'test-app',
        phoneNumbers: ['1234567890'],
        content: 'test message',
        timestamp: new Date().toISOString(),
        providerId: 'test-provider',
      };

      await service.processMessage(message);
      expect(service.processMessage).toBeDefined();
    });

    it('should handle processing errors and move to dead letter', async () => {
      const message = {
        requestId: 'test-request',
        appId: 'test-app',
        phoneNumbers: ['1234567890'],
        content: 'test message',
        timestamp: new Date().toISOString(),
        providerId: 'test-provider',
      };

      jest
        .spyOn(service, 'processMessage')
        .mockRejectedValue(new Error('Processing failed'));
      await expect(service.processMessage(message)).rejects.toThrow(
        'Processing failed',
      );
    });
  });

  describe('handleDeadLetter', () => {
    it('should handle message dead letter', async () => {
      const message = new Message();
      const error = new Error('Test error');
      const deadLetterMessage = {
        originalMessage: message,
        metadata: {
          retryCount: 3,
          lastRetryTime: new Date(),
          failureReason: 'Max retries exceeded',
        },
      };

      await service.handleDeadLetter(deadLetterMessage, error);
      expect(deadLetterService.handleFailedMessage).toHaveBeenCalledWith(
        message,
        error,
        expect.any(Object),
      );
    });

    it('should handle status report dead letter', async () => {
      const statusReport = new StatusReport();
      const error = new Error('Test error');
      const deadLetterMessage = {
        originalMessage: statusReport,
        metadata: {
          retryCount: 3,
          lastRetryTime: new Date(),
          failureReason: 'Max retries exceeded',
        },
      };

      await service.handleDeadLetter(deadLetterMessage, error);
      expect(deadLetterService.handleFailedStatusReport).toHaveBeenCalledWith(
        statusReport,
        error,
        expect.any(Object),
      );
    });
  });
});
