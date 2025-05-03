// import { MessageStatusEnum } from '../../entities/message.entity';

export interface SendMessageParams {
  destination: string;
  message: string;
  sourceAddr?: string;
  dataCoding?: number;
  priority?: number;
  validityPeriod?: number;
  serviceType?: string;
  registeredDelivery?: number;
  replaceIfPresent?: number;
  protocolId?: number;
  providerId?: string;
  messageId: string;
  content: string;
  phoneNumber: string;
  phoneNumbers?: string[];
  senderId: string;
  scheduleTime?: Date;
  orderId?: string;
}

export interface MessageResult {
  messageId: string;
  phoneNumber: string;
  orderId?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface SendMessageResult {
  messageId?: string;
  status: string;
  error?: string;
  successCount?: number;
  failCount?: number;
  messageResults?: MessageResult[];
}

export interface BalanceInfo {
  balance: number;
  currency: string;
  amount?: number;
}

export interface MessageStatusResponse {
  messageId: string;
  phoneNumber: string;
  status: ProviderStatus;
  deliveredAt?: string;
  errorMessage?: string;
}

export enum ProviderStatusEnum {
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
}

export type ProviderStatus = 'DELIVERED' | 'FAILED' | 'PENDING' | 'EXPIRED';

export interface SmppProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  initialize(): Promise<void>;
  queryMessageStatus(messageId: string): Promise<MessageStatusResponse>;
  getBalance(): Promise<BalanceInfo>;
  testConnection(): Promise<boolean>;
  getProviderId(): string;
  getSessionId(): string;
  getState(): string;
  getSystemId(): string;
  getSystemType(): string;
  getBindType(): string;
  getAddressRange(): string;
  getVersion(): string;
  getTotalMessages(): number;
  getSuccessMessages(): number;
  getFailedMessages(): number;
  isConnected(): boolean;
}
