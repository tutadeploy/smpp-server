import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefaultSmppClient } from './implementations/default-smpp-client';
import { SmppProvider } from './interfaces/provider.interface';
import { SmppSessionConfig } from './interfaces/smpp-session.interface';
import { StatusReport } from '../entities/status-report.entity';
import { Message, MessageStatusEnum } from '../entities/message.entity';
import { Provider } from '../entities/provider.entity';
import { ISmppClientService } from './interfaces/smpp-client.interface';

@Injectable()
export class SmppClientService implements OnModuleInit, ISmppClientService {
  private readonly logger = new Logger(SmppClientService.name);
  private readonly clients: Map<string, SmppProvider> = new Map();
  private activeProviderId: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StatusReport)
    private readonly statusReportRepository: Repository<StatusReport>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    await this.initializeClients();
  }

  private async initializeClients() {
    try {
      console.log('开始初始化SMPP客户端...');
      // 从数据库获取所有已启用的提供商
      const providers = await this.providerRepository.find({
        where: { status: 1 }, // 仅获取已启用的提供商
      });

      if (providers.length === 0) {
        console.error('数据库中未找到已启用的SMPP提供商配置');
        this.logger.warn('数据库中未找到已启用的SMPP提供商配置');
        return;
      }

      console.log(`从数据库加载了${providers.length}个SMPP提供商配置`);
      this.logger.log(`从数据库加载了${providers.length}个SMPP提供商配置`);

      // 获取当前激活的提供商ID，直接从环境变量中读取
      const activeProviderId =
        process.env.ACTIVE_PROVIDER_ID || providers[0].providerId;
      this.activeProviderId = activeProviderId;
      console.log(`当前激活的提供商ID: ${activeProviderId}`);
      this.logger.log(`当前激活的提供商ID: ${activeProviderId}`);

      // 添加日志
      providers.forEach((provider) => {
        console.log(
          `SMPP提供商: ${provider.providerId}, 连接信息: ${provider.host}:${provider.port}, ` +
            `系统ID: ${provider.systemId}, 优先级: ${provider.priority}, 权重: ${provider.weight}`,
        );
        this.logger.log(
          `SMPP提供商: ${provider.providerId}, 连接信息: ${provider.host}:${provider.port}, ` +
            `系统ID: ${provider.systemId}, 优先级: ${provider.priority}, 权重: ${provider.weight}`,
        );
      });

      // 初始化提供商客户端，先尝试激活的提供商，再按优先级排序
      const sortedProviders = [...providers].sort((a, b) => {
        // 激活的提供商优先
        if (a.providerId === this.activeProviderId) return -1;
        if (b.providerId === this.activeProviderId) return 1;
        // 然后按优先级排序（数字越小优先级越高）
        return a.priority - b.priority;
      });

      for (const provider of sortedProviders) {
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 3000;

        while (retryCount < maxRetries) {
          try {
            console.log(
              `正在初始化SMPP提供商 ${provider.providerId} (尝试 ${
                retryCount + 1
              }/${maxRetries})...`,
            );
            const sessionConfig: SmppSessionConfig = {
              host: provider.host,
              port: provider.port,
              systemId: provider.systemId,
              password: provider.password,
              systemType: provider.systemType || '',
              addressRange: provider.sourceAddr || '',
              enquireLinkTimer: provider.connectTimeout || 30000,
              reconnectTimer: provider.reconnectInterval || 5000,
              maxConnections: provider.maxConnections || 1,
              providerId: provider.providerId,
            };

            console.log(
              `SMPP会话配置: ${JSON.stringify(sessionConfig, null, 2)}`,
            );

            const client = new DefaultSmppClient(
              this.statusReportRepository,
              this.messageRepository,
              this.configService,
            );

            // 为客户端设置名称和配置属性，用于连接
            if (client instanceof DefaultSmppClient) {
              Object.assign(client, {
                name: provider.providerId,
                config: {
                  host: sessionConfig.host,
                  port: sessionConfig.port,
                  systemId: sessionConfig.systemId,
                  password: sessionConfig.password,
                  systemType: sessionConfig.systemType,
                  addressRange: sessionConfig.addressRange,
                  enquireLinkTimer: sessionConfig.enquireLinkTimer,
                },
              });
            }

            this.clients.set(provider.providerId, client);
            console.log(`SMPP客户端 [${provider.providerId}] 初始化成功`);
            this.logger.log(`SMPP客户端 [${provider.providerId}] 初始化成功`);

            // 如果这是激活的提供商，记录下来
            if (provider.providerId === this.activeProviderId) {
              console.log(`激活的SMPP提供商: ${provider.providerId}`);
              this.logger.log(`激活的SMPP提供商: ${provider.providerId}`);
            }

            await client.initialize();
            return true;
          } catch (err) {
            const error = err as Error;
            retryCount++;

            console.error(
              `初始化SMPP客户端失败 [${provider.providerId}]: ${error.message}`,
              error.stack,
            );
            this.logger.error(
              `初始化SMPP客户端失败 [${provider.providerId}]: ${error.message}`,
              error.stack,
            );

            if (retryCount < maxRetries - 1) {
              this.logger.log(
                `尝试重新初始化SMPP客户端 ${provider.providerId} (${retryCount}/${maxRetries})...`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              return this.initializeClients();
            }
            return false;
          }
        }
      }

      if (this.clients.size === 0) {
        console.error('没有任何SMPP客户端初始化成功');
        this.logger.error('没有任何SMPP客户端初始化成功');
      } else {
        console.log(`成功初始化 ${this.clients.size} 个SMPP客户端`);
        this.logger.log(`成功初始化 ${this.clients.size} 个SMPP客户端`);
      }
    } catch (error) {
      console.error(`加载提供商配置失败: ${error.message}`, error.stack);
      this.logger.error(`加载提供商配置失败: ${error.message}`, error.stack);
    }
  }

  async getClient(providerId?: string): Promise<SmppProvider | undefined> {
    // 如果未指定提供商ID，则返回激活的提供商客户端
    if (!providerId) {
      return this.clients.get(this.activeProviderId);
    }

    // 如果指定了提供商ID，返回对应的客户端
    return this.clients.get(providerId);
  }

  /**
   * 获取当前激活的提供商ID
   */
  getActiveProviderId(): string | null {
    return this.activeProviderId;
  }

  /**
   * 切换激活的提供商
   * @param providerId 要切换到的提供商ID
   * @returns 切换是否成功
   */
  async switchActiveProvider(providerId: string): Promise<boolean> {
    if (!this.clients.has(providerId)) {
      this.logger.error(`无法切换到提供商 ${providerId}: 该提供商未初始化`);
      return false;
    }

    this.activeProviderId = providerId;
    this.logger.log(`已切换到提供商: ${providerId}`);
    return true;
  }

  /**
   * 获取所有已初始化的提供商客户端
   */
  getAllClients(): Map<string, SmppProvider> {
    return this.clients;
  }

  /**
   * 查询消息状态
   * @param messageId 消息ID
   * @param provider 提供商名称，默认使用激活的提供商
   */
  async queryMessageStatus(
    messageId: string,
    provider?: string,
  ): Promise<string | null> {
    try {
      const providerId = provider || this.activeProviderId;
      const client = await this.getClient(providerId);
      if (!client) {
        this.logger.error(`未找到有效的SMPP客户端: ${providerId}`);
        return null;
      }
      const status = await client.queryMessageStatus(messageId);
      return status?.status;
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

  /**
   * 获取消息状态 (为StatusController提供)
   * @param messageId 消息ID
   */
  async getMessageStatus(messageId: string): Promise<StatusReport> {
    try {
      const statusReport = await this.statusReportRepository.findOne({
        where: { messageId },
      });
      if (!statusReport) {
        this.logger.warn(
          `Status report not found for message ID: ${messageId}`,
        );
        throw new Error(`Status report not found for message ID: ${messageId}`);
      }
      return statusReport;
    } catch (error) {
      this.logger.error(
        `Failed to get message status for ${messageId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 获取消息统计数据 (为StatusController提供)
   */
  async getMessageStats(): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }> {
    try {
      // 查询总消息数
      const total = await this.messageRepository.count();
      // 查询已送达消息数
      const delivered = await this.messageRepository.count({
        where: { status: MessageStatusEnum.DELIVERED },
      });
      // 查询失败消息数
      const failed = await this.messageRepository.count({
        where: { status: MessageStatusEnum.FAILED },
      });
      // 查询待处理消息数
      const pending = await this.messageRepository.count({
        where: { status: MessageStatusEnum.PENDING },
      });
      return { total, delivered, failed, pending };
    } catch (error) {
      this.logger.error(
        `Failed to get message stats: ${error.message}`,
        error.stack,
      );
      return { total: 0, delivered: 0, failed: 0, pending: 0 };
    }
  }
}
