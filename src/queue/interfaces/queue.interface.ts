export interface QueueMessage {
  messageId: string;
  content: string;
  phoneNumber: string;
  senderId: string;
  scheduleTime?: Date;
  orderId?: string;
  retryCount?: number;
  appId: string;
  providerId?: string;
  timestamp?: string;
}

export interface DeadLetterMessage {
  originalMessage: QueueMessage;
  metadata: {
    retryCount: number;
    lastRetryTime: Date;
    failureReason: string;
  };
}

export interface StatusReportDeadLetterMessage {
  messageId: string;
  providerMessageId: string;
  status: string;
  error: Error;
  retryCount: number;
}

export interface IQueueService {
  enqueueMessage(message: QueueMessage): Promise<void>;
  processMessage(message: QueueMessage): Promise<void>;
  handleDeadLetter(
    message: DeadLetterMessage | StatusReportDeadLetterMessage,
    error: Error,
  ): Promise<void>;
}
