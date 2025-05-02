import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultSmppClient } from './implementations/default-smpp-client';
import { SmppProvider } from './interfaces/provider.interface';
import { SmppSessionConfig } from './interfaces/smpp-session.interface';

interface SmppProviderConfig {
  name: string;
  host: string;
  port: number;
  systemId: string;
  password: string;
  systemType: string;
  addressRange?: string;
  enquireLinkTimer?: number;
  reconnectTimer?: number;
  maxConnections?: number;
}

@Injectable()
export class SmppClientService implements OnModuleInit {
  private readonly logger = new Logger(SmppClientService.name);
  private readonly clients: Map<string, SmppProvider> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeClients();
  }

  private async initializeClients() {
    const providers =
      this.configService.get<SmppProviderConfig[]>('app.smpp.providers') || [];

    if (providers.length === 0) {
      this.logger.warn('未找到SMPP提供商配置');
      return;
    }

    for (const provider of providers) {
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          this.logger.log(
            `正在初始化SMPP客户端 [${provider.name}] (尝试 ${retryCount + 1}/${maxRetries})`,
          );
          const client = await this.createClient(provider);
          this.clients.set(provider.name, client);
          this.logger.log(`SMPP客户端 [${provider.name}] 初始化成功`);
          break;
        } catch (error) {
          const err = error as Error;
          retryCount++;

          if (retryCount >= maxRetries) {
            this.logger.error(
              `初始化SMPP客户端失败 [${provider.name}]: ${err.message}，已达到最大重试次数`,
              err.stack,
            );
          } else {
            this.logger.warn(
              `初始化SMPP客户端失败 [${provider.name}]: ${err.message}，将在3秒后重试`,
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      }
    }

    // 检查是否有任何客户端初始化成功
    if (this.clients.size === 0) {
      this.logger.error('没有任何SMPP客户端初始化成功');
    } else {
      this.logger.log(`成功初始化 ${this.clients.size} 个SMPP客户端`);
    }
  }

  private async createClient(
    config: SmppProviderConfig,
  ): Promise<SmppProvider> {
    const sessionConfig: SmppSessionConfig = {
      host: config.host,
      port: config.port,
      systemId: config.systemId,
      password: config.password,
      systemType: config.systemType,
      addressRange: config.addressRange,
      enquireLinkTimer: config.enquireLinkTimer || 30000,
      reconnectTimer: config.reconnectTimer || 5000,
      maxConnections: config.maxConnections || 1,
    };

    const client = new DefaultSmppClient(config.name, sessionConfig);
    return client;
  }

  /**
   * 获取SMPP客户端
   * @param name 提供商名称
   */
  getClient(name: string = 'default'): SmppProvider {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`SMPP客户端未找到: ${name}`);
    }
    return client;
  }

  /**
   * 查询消息状态
   * @param messageId 消息ID
   * @param provider 提供商名称
   */
  async queryMessageStatus(
    messageId: string,
    provider: string = 'default',
  ): Promise<string | null> {
    try {
      const client = this.getClient(provider);
      const status = await client.queryMessageStatus(messageId);
      return status.status;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `查询消息状态失败 [${messageId}]: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * 测试所有SMPP连接
   */
  async testConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, client] of this.clients) {
      try {
        const isConnected = await client.testConnection();
        results.set(name, isConnected);
      } catch (error) {
        const err = error as Error;
        this.logger.error(`测试连接失败 [${name}]: ${err.message}`, err.stack);
        results.set(name, false);
      }
    }

    return results;
  }
}
