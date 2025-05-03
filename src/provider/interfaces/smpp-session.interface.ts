export interface SmppSessionConfig {
  host: string;
  port: number;
  systemId: string;
  password: string;
  systemType: string;
  addressRange?: string;
  enquireLinkTimer?: number;
  reconnectTimer?: number;
  maxReconnectAttempts?: number;
  maxConnections?: number;
  providerId?: string;
}

export interface SmppSessionInterface {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  bind(): Promise<void>;
  unbind(): Promise<void>;

  // 消息发送
  submitMessage(params: SubmitMessageParams): Promise<SubmitMessageResult>;

  // 状态查询
  querySm(params: QuerySmParams): Promise<QuerySmResult>;

  // 事件监听
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface SubmitMessageParams {
  sourceAddr: string;
  destinationAddr: string;
  shortMessage: string;
  scheduleDeliveryTime?: Date;
  validityPeriod?: Date;
  registeredDelivery?: boolean;
  dataCoding?: number;
  messageClass?: number;
}

export interface SubmitMessageResult {
  messageId: string;
  commandStatus: number;
  sequenceNumber: number;
}

export interface QuerySmParams {
  messageId: string;
  sourceAddr: string;
  destinationAddr?: string;
}

export interface QuerySmResult {
  messageId: string;
  messageState: number;
  finalDate?: Date;
  errorCode?: number;
}
