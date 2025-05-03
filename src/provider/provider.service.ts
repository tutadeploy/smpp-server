import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Provider } from '../entities/provider.entity';
import {
  SendMessageParams,
  SendMessageResult,
  BalanceInfo,
  MessageStatusResponse,
} from './interfaces/provider.interface';
import {
  IMetricsService,
  METRICS_SERVICE,
} from './interfaces/metrics.interface';
import { SMPP_CLIENT_SERVICE } from './provider.constants';
import { ISmppClientService } from './interfaces/smpp-client.interface';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    private readonly configService: ConfigService,
    @Inject(METRICS_SERVICE)
    private readonly metricsService: IMetricsService,
    @Inject(SMPP_CLIENT_SERVICE)
    private readonly smppClientService: ISmppClientService,
  ) {}

  /**
   * 获取所有提供商
   */
  async getAllProviders(): Promise<Provider[]> {
    return this.providerRepository.find();
  }

  /**
   * 获取活跃的提供商
   */
  async getActiveProvider(): Promise<Provider | null> {
    const activeProviderId = this.smppClientService.getActiveProviderId();
    if (!activeProviderId) {
      return null;
    }
    return this.providerRepository.findOne({
      where: { providerId: activeProviderId },
    });
  }

  /**
   * 切换活跃的提供商
   */
  async switchProvider(providerId: string): Promise<boolean> {
    const provider = await this.providerRepository.findOne({
      where: { providerId },
    });
    if (!provider) {
      return false;
    }
    return this.smppClientService.switchActiveProvider(providerId);
  }

  /**
   * 发送短信消息
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      const client = await this.smppClientService.getClient();
      if (!client) {
        throw new Error('No active SMPP client available');
      }

      const result = await client.sendMessage(params);

      this.metricsService.incrementCounter('sms_sent_total', {
        status: result.status,
        provider: params.providerId || 'default',
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send message: ${error.message}`,
        error.stack,
      );
      this.metricsService.incrementCounter('sms_sent_total', {
        status: 'error',
        provider: params.providerId || 'default',
      });
      throw error;
    }
  }

  /**
   * 查询消息状态
   */
  async queryMessageStatus(
    messageId: string,
    providerId?: string,
  ): Promise<MessageStatusResponse | null> {
    try {
      const client = await this.smppClientService.getClient(providerId);
      if (!client) {
        return null;
      }

      // 使用SmppProvider接口定义的方法直接查询
      return await client.queryMessageStatus(messageId);
    } catch (error) {
      this.logger.error(
        `Failed to query message status: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * 获取提供商余额
   */
  async getBalance(providerId?: string): Promise<BalanceInfo | null> {
    try {
      const client = await this.smppClientService.getClient(providerId);
      if (!client) {
        return null;
      }
      return client.getBalance();
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 检查提供商状态
   */
  async testConnection(providerId?: string): Promise<boolean> {
    try {
      const client = await this.smppClientService.getClient(providerId);
      if (!client) {
        return false;
      }
      return await client.testConnection();
    } catch (error) {
      this.logger.error(
        `Failed to test connection: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * 关闭提供商连接
   */
  async disconnect(providerId?: string): Promise<void> {
    try {
      const client = await this.smppClientService.getClient(providerId);
      if (client) {
        await client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect: ${error.message}`, error.stack);
      throw error;
    }
  }
}
