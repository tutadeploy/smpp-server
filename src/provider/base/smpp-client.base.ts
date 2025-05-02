import { Logger } from '@nestjs/common';
import {
  SmppProvider,
  SendMessageParams,
  SendMessageResult,
  BalanceInfo,
  MessageStatus,
} from '../interfaces/provider.interface';
import {
  SmppSessionInterface,
  SmppSessionConfig,
} from '../interfaces/smpp-session.interface';

export abstract class BaseSmppClient implements SmppProvider {
  protected readonly logger: Logger;
  protected session: SmppSessionInterface;
  protected isConnected: boolean = false;
  protected isInitialized: boolean = false;
  protected reconnectAttempts: number = 0;
  protected readonly maxReconnectAttempts: number = 5;

  constructor(
    protected readonly name: string,
    protected readonly config: SmppSessionConfig,
  ) {
    this.logger = new Logger(`SmppClient-${name}`);
  }

  /**
   * 初始化SMPP客户端
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.log(`正在初始化SMPP客户端 ${this.name}`);
      await this.connect();
      this.setupEventHandlers();
      this.isInitialized = true;
      this.logger.log(`SMPP客户端 ${this.name} 初始化成功`);
    } catch (error) {
      this.logger.error(
        `SMPP客户端 ${this.name} 初始化失败: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 连接到SMPP服务器
   */
  protected abstract connect(): Promise<void>;

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
      if (!this.isConnected) {
        await this.reconnect();
      }

      // 实现短信发送逻辑
      return await this.doSendMessage(params);
    } catch (error) {
      this.logger.error(`发送短信失败: ${error.message}`, error.stack);

      // 连接错误时尝试重连
      if (this.isConnectionError(error)) {
        this.isConnected = false;
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
        successCount: 0,
        failCount: params.phoneNumbers.length,
        messageResults: params.phoneNumbers.map((phoneNumber) => ({
          messageId: '',
          phoneNumber,
          status: 'failed',
          errorMessage: error.message,
        })),
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
  async queryMessageStatus(messageId: string): Promise<MessageStatus> {
    try {
      if (!this.isConnected) {
        await this.reconnect();
      }

      // 实现状态查询逻辑
      return await this.doQueryMessageStatus(messageId);
    } catch (error) {
      this.logger.error(`查询消息状态失败: ${error.message}`, error.stack);

      if (this.isConnectionError(error)) {
        this.isConnected = false;
      }

      return {
        messageId,
        phoneNumber: '',
        status: 'failed',
        errorMessage: error.message,
      };
    }
  }

  /**
   * 实际执行消息状态查询
   * @param messageId 消息ID
   */
  protected abstract doQueryMessageStatus(
    messageId: string,
  ): Promise<MessageStatus>;

  /**
   * 获取账户余额
   */
  abstract getBalance(): Promise<BalanceInfo>;

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      return this.isConnected;
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
  protected convertMessageState(
    state: number,
  ): 'delivered' | 'failed' | 'pending' | 'expired' {
    switch (state) {
      case 2: // DELIVERED
        return 'delivered';
      case 3: // EXPIRED
        return 'expired';
      case 8: // REJECTED
      case 9: // UNDELIVERABLE
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.doDisconnect();
        this.isConnected = false;
        this.logger.log(`SMPP客户端 ${this.name} 已断开连接`);
      } catch (error) {
        this.logger.error(
          `SMPP客户端 ${this.name} 断开连接失败: ${error.message}`,
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
}
