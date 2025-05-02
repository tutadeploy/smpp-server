import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../monitoring/metrics.service';
import { SmppClientService } from '../provider/smpp-client.service';
import {
  SendMessageParams,
  SendMessageResult,
} from '../provider/interfaces/provider.interface';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly smppClientService: SmppClientService,
  ) {}

  /**
   * 发送短信消息
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    this.logger.debug(`准备发送短信: ${JSON.stringify(params)}`);
    try {
      const client = this.smppClientService.getClient();
      if (!client) {
        throw new Error('SMPP客户端未初始化');
      }
      this.logger.debug('成功获取SMPP客户端');

      const result = await client.sendMessage(params);
      this.logger.debug(`短信发送成功: ${JSON.stringify(result)}`);

      // 记录发送成功指标
      this.metricsService.incrementCounter('sms_sent_total', {
        status: 'success',
        provider: 'default',
      });

      return result;
    } catch (error) {
      this.logger.error(`发送短信失败: ${error.message}`, error.stack);
      // 记录发送失败指标
      this.metricsService.incrementCounter('sms_sent_total', {
        status: 'error',
        provider: 'default',
      });
      throw error;
    }
  }

  /**
   * 检查提供商状态
   */
  async checkStatus(): Promise<boolean> {
    try {
      const client = this.smppClientService.getClient();
      return await client.testConnection();
    } catch (error) {
      this.logger.error(`检查提供商状态失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 关闭提供商连接
   */
  async disconnect(): Promise<void> {
    try {
      const client = this.smppClientService.getClient();
      await client.disconnect();
    } catch (error) {
      this.logger.error(`关闭提供商连接失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
