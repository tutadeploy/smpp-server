import { Test, TestingModule } from '@nestjs/testing';
import { SmppClientService } from './smpp-client.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatusReport } from '../entities/status-report.entity';
import { Message } from '../entities/message.entity';
import { Provider } from '../entities/provider.entity';
import { DefaultSmppClient } from './implementations/default-smpp-client';
import { SmppProvider } from './interfaces/provider.interface';

describe('SmppClientService', () => {
  let service: SmppClientService;
  let providerRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmppClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StatusReport),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DefaultSmppClient,
          useValue: {
            initialize: jest.fn(),
            sendMessage: jest.fn(),
            testConnection: jest.fn(),
            disconnect: jest.fn(),
            queryMessageStatus: jest.fn(),
            getBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SmppClientService>(SmppClientService);
    providerRepository = module.get(getRepositoryToken(Provider));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize clients successfully', async () => {
      const mockProviders = [
        {
          providerId: 'test-provider',
          host: 'test-host',
          port: 2775,
          systemId: 'test-system',
          password: 'test-password',
          status: 1,
        },
      ];

      providerRepository.find.mockResolvedValue(mockProviders);

      await service.initialize();

      expect(providerRepository.find).toHaveBeenCalledWith({
        where: { status: 1 },
      });
    });

    it('should handle initialization failure', async () => {
      providerRepository.find.mockRejectedValue(new Error('Database error'));

      await service.initialize();

      expect(providerRepository.find).toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('should return client for specified provider', async () => {
      const mockClient: SmppProvider = {
        initialize: jest.fn(),
        sendMessage: jest.fn(),
        testConnection: jest.fn(),
        disconnect: jest.fn(),
        queryMessageStatus: jest.fn(),
        getBalance: jest.fn(),
      };

      service['clients'].set('test-provider', mockClient);

      const result = await service.getClient('test-provider');

      expect(result).toBe(mockClient);
    });

    it('should return active client when no provider specified', async () => {
      const mockClient: SmppProvider = {
        initialize: jest.fn(),
        sendMessage: jest.fn(),
        testConnection: jest.fn(),
        disconnect: jest.fn(),
        queryMessageStatus: jest.fn(),
        getBalance: jest.fn(),
      };

      service['activeProviderId'] = 'test-provider';
      service['clients'].set('test-provider', mockClient);

      const result = await service.getClient();

      expect(result).toBe(mockClient);
    });

    it('should return undefined for non-existent provider', async () => {
      const result = await service.getClient('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('switchActiveProvider', () => {
    it('should switch active provider successfully', async () => {
      const mockClient: SmppProvider = {
        initialize: jest.fn(),
        sendMessage: jest.fn(),
        testConnection: jest.fn(),
        disconnect: jest.fn(),
        queryMessageStatus: jest.fn(),
        getBalance: jest.fn(),
      };

      service['clients'].set('new-provider', mockClient);

      const result = await service.switchActiveProvider('new-provider');

      expect(result).toBe(true);
      expect(service['activeProviderId']).toBe('new-provider');
    });

    it('should fail to switch to non-existent provider', async () => {
      const result = await service.switchActiveProvider('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('testConnections', () => {
    it('should test all connections', async () => {
      const mockClient1: SmppProvider = {
        initialize: jest.fn(),
        sendMessage: jest.fn(),
        testConnection: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn(),
        queryMessageStatus: jest.fn(),
        getBalance: jest.fn(),
      };
      const mockClient2: SmppProvider = {
        initialize: jest.fn(),
        sendMessage: jest.fn(),
        testConnection: jest.fn().mockResolvedValue(false),
        disconnect: jest.fn(),
        queryMessageStatus: jest.fn(),
        getBalance: jest.fn(),
      };

      service['clients'].set('provider1', mockClient1);
      service['clients'].set('provider2', mockClient2);

      const results = await service.testConnections();

      expect(results.get('provider1')).toBe(true);
      expect(results.get('provider2')).toBe(false);
    });
  });
});
