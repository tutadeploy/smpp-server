import { Message } from '../../entities/message.entity';
import { RecordResponseDto } from '../../api/dto/record-response.dto';

export interface IRecordService {
  getSmsRecordById(appId: string, messageId: string): Promise<Message>;
  getSmsStatistics(
    appId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }>;
  getSmsRecords(
    appId: string,
    page: number,
    pageSize: number,
    startDate?: Date,
    endDate?: Date,
    phoneNumber?: string,
    status?: string,
  ): Promise<RecordResponseDto>;
}
