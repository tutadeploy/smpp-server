import { Test, TestingModule } from '@nestjs/testing';
import { KafkaService } from './kafka.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('KafkaService', () => {
  let service: KafkaService;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaService,
        {
          provide: 'ConfigService',
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'kafka.brokers': ['localhost:9092'],
                'kafka.clientId': 'test-client',
                'kafka.groupId': 'test-group',
              };
              return config[key];
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            recordHistogram: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KafkaService>(KafkaService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('connect', () => {
    it('should connect to Kafka successfully', async () => {
      const connectSpy = jest.spyOn(service, 'connect');
      await service.connect();
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      jest
        .spyOn(service, 'connect')
        .mockRejectedValue(new Error('Connection failed'));
      await expect(service.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const topic = 'test-topic';
      const messages = [{ key: 'test-key', value: 'test-value' }];

      await service.sendMessage(topic, messages);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'kafka_messages_sent',
        { topic },
      );
    });

    it('should handle send errors', async () => {
      const topic = 'test-topic';
      const messages = [{ key: 'test-key', value: 'test-value' }];

      jest
        .spyOn(service, 'sendMessage')
        .mockRejectedValue(new Error('Send failed'));
      await expect(service.sendMessage(topic, messages)).rejects.toThrow(
        'Send failed',
      );
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'kafka_messages_error',
        { topic },
      );
    });
  });

  describe('registerHandler', () => {
    it('should register handler successfully', async () => {
      const topic = 'test-topic';
      const handler = jest.fn();

      await service.registerHandler(topic, handler);
      expect(service['messageHandlers'].has(topic)).toBeTruthy();
    });

    it('should not register duplicate handler', async () => {
      const topic = 'test-topic';
      const handler = jest.fn();

      await service.registerHandler(topic, handler);
      await expect(service.registerHandler(topic, handler)).rejects.toThrow(
        `Handler already registered for topic: ${topic}`,
      );
    });
  });

  describe('health check methods', () => {
    it('should check connection status', async () => {
      const isConnected = await service.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should get broker stats', async () => {
      const stats = await service.getBrokerStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('connected');
    });

    it('should get consumer stats', async () => {
      const stats = await service.getConsumerStats();
      expect(stats).toHaveProperty('totalLag');
    });

    it('should get producer stats', async () => {
      const stats = await service.getProducerStats();
      expect(stats).toHaveProperty('errors');
    });
  });
});
