import { Message } from '../../entities/message.entity';
import { StatusReport } from '../../entities/status-report.entity';
import {
  DeadLetterMessage,
  StatusReportDeadLetterMessage,
} from '../dead-letter.service';

export interface IDeadLetterService {
  handleFailedMessage(
    message: Message,
    error: Error,
    metadata: {
      retryCount: number;
      lastRetryTime: Date;
      failureReason: string;
    },
  ): Promise<void>;

  handleFailedStatusReport(
    report: StatusReport,
    error: Error,
    metadata: {
      retryCount: number;
      lastRetryTime: Date;
      failureReason: string;
    },
  ): Promise<void>;

  retryMessage(
    message: DeadLetterMessage | StatusReportDeadLetterMessage,
  ): Promise<void>;
}
