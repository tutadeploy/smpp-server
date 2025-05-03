import { Test, TestingModule } from '@nestjs/testing';
import { DeadLetterService } from './dead-letter.service';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MetricsService } from '../monitoring/metrics.service';

describe('DeadLetterService', () => {
  let service: DeadLetterService;
  let messageRepository: Repository<Message>;
  let statusReportRepository: Repository<StatusReport>;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterService,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StatusReport),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
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

    service = module.get<DeadLetterService>(DeadLetterService);
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
    statusReportRepository = module.get<Repository<StatusReport>>(
      getRepositoryToken(StatusReport),
    );
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleFailedMessage', () => {
    it('should handle failed message successfully', async () => {
      const message = new Message();
      const error = new Error('Test error');
      const metadata = {
        retryCount: 3,
        lastRetryTime: new Date(),
        failureReason: 'Max retries exceeded',
      };

      await service.handleFailedMessage(message, error, metadata);
      expect(messageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          errorMessage: error.message,
        }),
      );
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'dead_letter_messages',
      );
    });

    it('should handle save errors', async () => {
      const message = new Message();
      const error = new Error('Test error');
      const metadata = {
        retryCount: 3,
        lastRetryTime: new Date(),
        failureReason: 'Max retries exceeded',
      };

      jest
        .spyOn(messageRepository, 'save')
        .mockRejectedValue(new Error('Save failed'));
      await expect(
        service.handleFailedMessage(message, error, metadata),
      ).rejects.toThrow('Save failed');
    });
  });

  describe('handleFailedStatusReport', () => {
    it('should handle failed status report successfully', async () => {
      const statusReport = new StatusReport();
      const error = new Error('Test error');
      const metadata = {
        retryCount: 3,
        lastRetryTime: new Date(),
        failureReason: 'Max retries exceeded',
      };

      await service.handleFailedStatusReport(statusReport, error, metadata);
      expect(statusReportRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          errorMessage: error.message,
        }),
      );
      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'dead_letter_status_reports',
      );
    });

    it('should handle save errors', async () => {
      const statusReport = new StatusReport();
      const error = new Error('Test error');
      const metadata = {
        retryCount: 3,
        lastRetryTime: new Date(),
        failureReason: 'Max retries exceeded',
      };

      jest
        .spyOn(statusReportRepository, 'save')
        .mockRejectedValue(new Error('Save failed'));
      await expect(
        service.handleFailedStatusReport(statusReport, error, metadata),
      ).rejects.toThrow('Save failed');
    });
  });
});
