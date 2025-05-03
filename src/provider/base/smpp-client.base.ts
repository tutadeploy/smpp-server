import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SmppProvider,
  SendMessageParams,
  SendMessageResult,
  BalanceInfo,
  MessageStatusResponse,
  ProviderStatus,
  ProviderStatusEnum,
} from '../interfaces/provider.interface';
import { SmppSessionInterface } from '../interfaces/smpp-session.interface';
import { MessageStatusEnum } from '../../entities/message.entity';

export type MessageStatus = MessageStatusEnum;
export {
  SendMessageParams,
  SendMessageResult,
} from '../interfaces/provider.interface';

@Injectable()
export abstract class BaseSmppClient implements SmppProvider {
  protected readonly logger = new Logger(this.constructor.name);
  protected session: SmppSessionInterface;
  protected _isConnected = false;
  protected isInitialized = false;
  protected reconnectAttempts = 0;
  protected readonly maxReconnectAttempts: number = 5;
  protected totalMessages = 0;
  protected successMessages = 0;
  protected failedMessages = 0;

  constructor(protected readonly configService: ConfigService) {}

  /**
   * 初始化SMPP客户端
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.log(`正在初始化SMPP客户端 ${this.constructor.name}`);
      await this.connect();
      this.setupEventHandlers();
      this.isInitialized = true;
      this.logger.log(`SMPP客户端 ${this.constructor.name} 初始化成功`);
    } catch (error) {
      this.logger.error(
        `SMPP客户端 ${this.constructor.name} 初始化失败: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 连接到SMPP服务器
   */
  abstract connect(): Promise<void>;

  /**
   * 设置事件处理器
   */
  protected abstract setupEventHandlers(): void;

  /**
   * 发送短信
   * @param params 发送参数
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      if (!this._isConnected) {
        await this.reconnect();
      }

      // 实现短信发送逻辑
      const result = await this.doSendMessage(params);
      this.totalMessages++;
      if (result.status === 'success') {
        this.successMessages++;
      } else {
        this.failedMessages++;
      }
      return result;
    } catch (error) {
      this.logger.error(`发送短信失败: ${error.message}`, error.stack);
      this.failedMessages++;

      // 连接错误时尝试重连
      if (this.isConnectionError(error)) {
        this._isConnected = false;
        try {
          await this.reconnect();
        } catch (reconnectError) {
          this.logger.error(
            `重连失败: ${reconnectError.message}`,
            reconnectError.stack,
          );
        }
      }

      // 返回失败结果
      return {
        messageId: params.messageId,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * 实际执行短信发送
   * @param params 发送参数
   */
  protected abstract doSendMessage(
    params: SendMessageParams,
  ): Promise<SendMessageResult>;

  /**
   * 查询消息状态
   * @param messageId 消息ID
   */
  async queryMessageStatus(messageId: string): Promise<MessageStatusResponse> {
    try {
      if (!this._isConnected) {
        throw new Error('SMPP client is not connected');
      }
      return await this.doQueryMessageStatus(messageId);
    } catch (error) {
      this.logger.error(`Failed to query message status: ${error.message}`);
      throw error;
    }
  }

  /**
   * 实际执行消息状态查询
   * @param messageId 消息ID
   */
  protected abstract doQueryMessageStatus(
    messageId: string,
  ): Promise<MessageStatusResponse>;

  /**
   * 获取账户余额
   */
  abstract getBalance(): Promise<BalanceInfo>;

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this._isConnected) {
        await this.connect();
      }
      return this._isConnected;
    } catch (error) {
      this.logger.error(`测试连接失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 重新连接
   */
  protected async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error(`超过最大重连次数 ${this.maxReconnectAttempts}`);
    }

    this.reconnectAttempts++;
    this.logger.log(`尝试重新连接 (第 ${this.reconnectAttempts} 次)`);

    try {
      await this.connect();
      this.reconnectAttempts = 0;
      this.logger.log('重新连接成功');
    } catch (error) {
      this.logger.error(`重新连接失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 判断是否为连接错误
   * @param error 错误对象
   */
  protected abstract isConnectionError(error: any): boolean;

  /**
   * 转换消息状态
   * @param state SMPP消息状态
   */
  protected convertMessageState(state: number): ProviderStatus {
    switch (state) {
      case 2: // DELIVERED
        return ProviderStatusEnum.DELIVERED;
      case 3: // EXPIRED
        return ProviderStatusEnum.EXPIRED;
      case 8: // REJECTED
      case 9: // UNDELIVERABLE
        return ProviderStatusEnum.FAILED;
      default:
        return ProviderStatusEnum.PENDING;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this._isConnected) {
      try {
        await this.doDisconnect();
        this._isConnected = false;
        this.logger.log(`SMPP客户端 ${this.constructor.name} 已断开连接`);
      } catch (error) {
        this.logger.error(
          `SMPP客户端 ${this.constructor.name} 断开连接失败: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  /**
   * 实际执行断开连接
   */
  protected abstract doDisconnect(): Promise<void>;

  abstract getProviderId(): string;
  abstract getSessionId(): string;
  abstract getState(): string;
  abstract getSystemId(): string;
  abstract getSystemType(): string;
  abstract getBindType(): string;
  abstract getAddressRange(): string;
  abstract getVersion(): string;

  getTotalMessages(): number {
    return this.totalMessages;
  }

  getSuccessMessages(): number {
    return this.successMessages;
  }

  getFailedMessages(): number {
    return this.failedMessages;
  }

  isConnected(): boolean {
    return this._isConnected;
  }
}
