import { Test, TestingModule } from '@nestjs/testing';
import { ProviderService } from './provider.service';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../monitoring/metrics.service';
import { SmppClientService } from './smpp-client.service';
import {
  SendMessageParams,
  SendMessageResult,
} from './interfaces/provider.interface';

describe('ProviderService', () => {
  let service: ProviderService;
  let metricsService: MetricsService;
  let smppClientService: SmppClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
          },
        },
        {
          provide: SmppClientService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProviderService>(ProviderService);
    metricsService = module.get<MetricsService>(MetricsService);
    smppClientService = module.get<SmppClientService>(SmppClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockParams: SendMessageParams = {
        destination: '1234567890',
        message: 'Test message',
      };
      const mockResult: SendMessageResult = {
        messageId: 'test-message-id',
        status: 'success',
      };

      const mockClient = {
        initialize: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(mockResult),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.sendMessage(mockParams);

      expect(result).toEqual(mockResult);
      expect(mockClient.initialize).toHaveBeenCalled();
      expect(mockClient.sendMessage).toHaveBeenCalledWith(mockParams);
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'sms_sent_total',
        {
          status: 'success',
          provider: 'default',
        },
      );
    });

    it('should handle send message failure', async () => {
      const mockParams: SendMessageParams = {
        destination: '1234567890',
        message: 'Test message',
      };

      const mockClient = {
        initialize: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockRejectedValue(new Error('Send failed')),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.sendMessage(mockParams)).rejects.toThrow(
        'Send failed',
      );
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'sms_sent_total',
        {
          status: 'error',
          provider: 'default',
        },
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockClient = {
        testConnection: jest.fn().mockResolvedValue(true),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockClient.testConnection).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      const mockClient = {
        testConnection: jest
          .fn()
          .mockRejectedValue(new Error('Connection failed')),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const mockClient = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      await service.disconnect();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect failure', async () => {
      const mockClient = {
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed')),
      };

      (smppClientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });
});
