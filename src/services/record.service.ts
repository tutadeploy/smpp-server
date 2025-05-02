import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { LoggerService } from '../common/logger/logger.service';
import { RecordResponseDto } from '../api/dto/record-response.dto';

@Injectable()
export class RecordService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly logger: LoggerService,
  ) {}

  async getSmsRecords(
    appId: string,
    options: {
      page: number;
      pageSize: number;
      startDate?: Date;
      endDate?: Date;
      phoneNumber?: string;
      status?: string;
    },
  ): Promise<RecordResponseDto> {
    const {
      page = 1,
      pageSize = 10,
      startDate,
      endDate,
      phoneNumber,
      status,
    } = options;
    const skip = (page - 1) * pageSize;

    try {
      const queryBuilder = this.messageRepository
        .createQueryBuilder('message')
        .where('message.appId = :appId', { appId })
        .skip(skip)
        .take(pageSize)
        .orderBy('message.createdAt', 'DESC');

      if (startDate) {
        queryBuilder.andWhere('message.createdAt >= :startDate', { startDate });
      }

      if (endDate) {
        queryBuilder.andWhere('message.createdAt <= :endDate', { endDate });
      }

      if (phoneNumber) {
        queryBuilder.andWhere('message.phoneNumber = :phoneNumber', {
          phoneNumber,
        });
      }

      if (status) {
        queryBuilder.andWhere('message.status = :status', { status });
      }

      const [records, total] = await queryBuilder.getManyAndCount();

      return {
        status: '0',
        reason: '成功',
        page,
        pageSize,
        total,
        records: records.map((message) => ({
          messageId: message.messageId,
          phoneNumber: message.phoneNumber,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt?.toISOString(),
          sentAt: message.sendTime?.toISOString(),
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error fetching SMS records: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSmsRecordById(appId: string, messageId: string): Promise<Message> {
    try {
      return await this.messageRepository.findOne({
        where: { appId, messageId } as any,
      });
    } catch (error) {
      this.logger.error(
        `Error fetching SMS record by ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSmsStatistics(
    appId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }> {
    try {
      const queryBuilder = this.messageRepository
        .createQueryBuilder('message')
        .where('message.appId = :appId', { appId })
        .andWhere('message.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });

      const total = await queryBuilder.getCount();

      const delivered = await queryBuilder
        .clone()
        .andWhere('message.status = :status', { status: 'DELIVERED' })
        .getCount();

      const failed = await queryBuilder
        .clone()
        .andWhere('message.status IN (:...statuses)', {
          statuses: ['FAILED', 'ERROR'],
        })
        .getCount();

      const pending = await queryBuilder
        .clone()
        .andWhere('message.status IN (:...statuses)', {
          statuses: ['PENDING', 'SENDING'],
        })
        .getCount();

      return { total, delivered, failed, pending };
    } catch (error) {
      this.logger.error(
        `Error fetching SMS statistics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
