import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { StatusResponseDto } from '../api/dto/response.dto';

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async getMessageStatus(
    appId: string,
    msgId: string,
  ): Promise<StatusResponseDto> {
    try {
      // 查询消息状态
      const messages = await this.messageRepository.find({
        where: {
          appId,
          messageId: msgId,
        },
      });

      if (!messages || messages.length === 0) {
        return {
          status: '1',
          reason: 'Message not found',
          success: '0',
          fail: '0',
          sending: '0',
          notsend: '0',
          array: [],
        };
      }

      // 统计各状态数量
      const statusCounts = {
        success: 0,
        fail: 0,
        sending: 0,
        notsend: 0,
      };

      // 处理状态详情
      const statusDetails = messages.map((message) => {
        // 更新状态计数
        switch (message.status) {
          case 'DELIVERED':
            statusCounts.success++;
            break;
          case 'FAILED':
            statusCounts.fail++;
            break;
          case 'PENDING':
          case 'SENDING':
          case 'PROCESSING':
            statusCounts.sending++;
            break;
          case 'ERROR':
            statusCounts.fail++;
            break;
          default:
            statusCounts.notsend++;
        }

        // 构建状态详情
        return {
          msgId: message.messageId,
          number: message.phoneNumber,
          receiveTime:
            message.updateTime?.toISOString() || message.sendTime.toISOString(),
          status: message.status === 'DELIVERED' ? '0' : '1',
          pricedetail: {
            count: 1,
            price: 0,
            total: 0,
          },
        };
      });

      return {
        status: '0',
        reason: 'success',
        success: statusCounts.success.toString(),
        fail: statusCounts.fail.toString(),
        sending: statusCounts.sending.toString(),
        notsend: statusCounts.notsend.toString(),
        array: statusDetails,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get message status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
