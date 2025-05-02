export interface SendMessageParams {
  phoneNumbers: string[];
  content: string;
  senderId?: string;
  orderId?: string;
  scheduleTime?: Date;
}

export interface MessageResult {
  messageId: string;
  phoneNumber: string;
  orderId?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface SendMessageResult {
  successCount: number;
  failCount: number;
  messageResults: MessageResult[];
}

export interface BalanceInfo {
  amount: number;
  currency: string;
}

export interface MessageStatus {
  messageId: string;
  phoneNumber: string;
  status: 'delivered' | 'failed' | 'pending' | 'expired';
  deliveredAt?: string;
  errorMessage?: string;
}

export interface SmppProvider {
  initialize(): Promise<void>;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  queryMessageStatus(messageId: string): Promise<MessageStatus>;
  getBalance(): Promise<BalanceInfo>;
  testConnection(): Promise<boolean>;
  disconnect(): Promise<void>;
}
