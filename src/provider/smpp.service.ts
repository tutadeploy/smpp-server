import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultSmppClient } from './implementations/default-smpp-client';
import { SmppSessionConfig } from './interfaces/smpp-session.interface';

export interface SessionInfo {
  connected: boolean;
  host: string;
  port: number;
  lastConnectedAt: Date;
  reconnectAttempts: number;
}

export interface BindInfo {
  isBound: boolean;
  bindType: 'transmitter' | 'receiver' | 'transceiver';
  bindTime: Date;
  systemId: string;
  lastBindAttempt: Date;
}

export interface MessageStats {
  isOperational: boolean;
  lastMessageSentAt: Date;
  averageResponseTime: number;
  pendingMessages: number;
  messagesSentLast5Minutes: number;
  deliverySuccessRate: number;
  errors: Array<{
    code: string;
    message: string;
    timestamp: Date;
  }>;
}

@Injectable()
export class SmppService implements OnModuleInit {
  private readonly logger = new Logger(SmppService.name);
  private sessionInfo: SessionInfo;
  private bindInfo: BindInfo;
  private messageStats: MessageStats;
  private smppClient: DefaultSmppClient;

  constructor(private readonly configService: ConfigService) {
    this.initializeMetrics();
  }

  async onModuleInit() {
    const config: SmppSessionConfig = {
      host: this.configService.get<string>('smpp.host'),
      port: this.configService.get<number>('smpp.port'),
      systemId: this.configService.get<string>('smpp.systemId'),
      password: this.configService.get<string>('smpp.password'),
      systemType: this.configService.get<string>('smpp.systemType'),
      addressRange: this.configService.get<string>('smpp.addressRange'),
      enquireLinkTimer: this.configService.get<number>(
        'smpp.enquireLinkTimer',
        30000,
      ),
      reconnectTimer: this.configService.get<number>(
        'smpp.reconnectTimer',
        5000,
      ),
      maxReconnectAttempts: this.configService.get<number>(
        'smpp.maxReconnectAttempts',
        5,
      ),
    };

    this.smppClient = new DefaultSmppClient('default', config);
    await this.smppClient.initialize();

    // 设置事件监听器来更新状态
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.smppClient) return;

    // 这里可以添加事件监听器来更新状态
    // 例如：连接状态变化、绑定状态变化等
  }

  private initializeMetrics(): void {
    this.sessionInfo = {
      connected: false,
      host: this.configService.get<string>('smpp.host'),
      port: this.configService.get<number>('smpp.port'),
      lastConnectedAt: null,
      reconnectAttempts: 0,
    };

    this.bindInfo = {
      isBound: false,
      bindType: 'transceiver',
      bindTime: null,
      systemId: this.configService.get<string>('smpp.systemId'),
      lastBindAttempt: null,
    };

    this.messageStats = {
      isOperational: false,
      lastMessageSentAt: null,
      averageResponseTime: 0,
      pendingMessages: 0,
      messagesSentLast5Minutes: 0,
      deliverySuccessRate: 0,
      errors: [],
    };
  }

  async getSessionInfo(): Promise<SessionInfo> {
    return this.sessionInfo;
  }

  async getBindInfo(): Promise<BindInfo> {
    return this.bindInfo;
  }

  async getMessageStats(): Promise<MessageStats> {
    return this.messageStats;
  }

  // 更新会话信息
  updateSessionInfo(info: Partial<SessionInfo>): void {
    this.sessionInfo = { ...this.sessionInfo, ...info };
  }

  // 更新绑定信息
  updateBindInfo(info: Partial<BindInfo>): void {
    this.bindInfo = { ...this.bindInfo, ...info };
  }

  // 更新消息统计信息
  updateMessageStats(stats: Partial<MessageStats>): void {
    this.messageStats = { ...this.messageStats, ...stats };
  }

  // 添加错误记录
  addError(code: string, message: string): void {
    this.messageStats.errors.push({
      code,
      message,
      timestamp: new Date(),
    });

    // 保持最近的100条错误记录
    if (this.messageStats.errors.length > 100) {
      this.messageStats.errors.shift();
    }
  }
}
