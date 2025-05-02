import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { SmppService } from '../../../provider/smpp.service';

@Injectable()
export class SmppHealthIndicator extends HealthIndicator {
  constructor(private readonly smppService: SmppService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 检查 SMPP 连接状态
      const connectionStatus = await this.checkConnection();

      // 检查绑定状态
      const bindStatus = await this.checkBindStatus();

      // 检查最近的消息发送状态
      const messageStatus = await this.checkMessageStatus();

      const isHealthy =
        connectionStatus.isConnected &&
        bindStatus.status &&
        messageStatus.status;

      const result = this.getStatus(key, isHealthy, {
        connection: connectionStatus,
        bind: bindStatus,
        messages: messageStatus,
      });

      return result;
    } catch (error) {
      throw new HealthCheckError(
        'SMPP health check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      );
    }
  }

  private async checkConnection(): Promise<{
    isConnected: boolean;
    details: Record<string, any>;
  }> {
    try {
      const sessionInfo = await this.smppService.getSessionInfo();
      const isConnected = sessionInfo.connected;

      return {
        isConnected,
        details: {
          host: sessionInfo.host,
          port: sessionInfo.port,
          lastConnectedAt: sessionInfo.lastConnectedAt,
          reconnectAttempts: sessionInfo.reconnectAttempts,
        },
      };
    } catch (error) {
      return {
        isConnected: false,
        details: {
          error: error.message,
          lastError: error.stack,
        },
      };
    }
  }

  private async checkBindStatus(): Promise<{
    status: boolean;
    details: Record<string, any>;
  }> {
    try {
      const bindInfo = await this.smppService.getBindInfo();

      return {
        status: bindInfo.isBound,
        details: {
          bindType: bindInfo.bindType,
          bindTime: bindInfo.bindTime,
          systemId: bindInfo.systemId,
          lastBindAttempt: bindInfo.lastBindAttempt,
        },
      };
    } catch (error) {
      return {
        status: false,
        details: {
          error: error.message,
          lastError: error.stack,
        },
      };
    }
  }

  private async checkMessageStatus(): Promise<{
    status: boolean;
    details: Record<string, any>;
  }> {
    try {
      const stats = await this.smppService.getMessageStats();

      return {
        status: stats.isOperational,
        details: {
          lastMessageSentAt: stats.lastMessageSentAt,
          averageResponseTime: stats.averageResponseTime,
          pendingMessages: stats.pendingMessages,
          messagesSentLast5Minutes: stats.messagesSentLast5Minutes,
          deliverySuccessRate: stats.deliverySuccessRate,
          errors: stats.errors,
        },
      };
    } catch (error) {
      return {
        status: false,
        details: {
          error: error.message,
          lastError: error.stack,
        },
      };
    }
  }
}
