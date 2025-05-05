import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as smpp from 'smpp';
import { Socket } from 'net';
import {
  BaseSmppClient,
  SendMessageParams,
  SendMessageResult,
} from '../base/smpp-client.base';
import {
  BalanceInfo,
  MessageResult,
  ProviderStatus,
  ProviderStatusEnum,
  MessageStatusResponse,
} from '../interfaces/provider.interface';
import { StatusReport } from '../../entities/status-report.entity';
import {
  Message,
  MessageStatus,
  MessageStatusEnum,
} from '../../entities/message.entity';
import { ConfigService } from '@nestjs/config';
import { SmppProvider } from '../interfaces/provider.interface';

interface SmppPDU {
  command_status: number;
  message_id?: string;
  sequence_number?: number;
  message_state?: number;
  final_date?: string;
  destination_addr?: string;
  esm_class?: number;
  short_message?: any;
}

@Injectable()
export class DefaultSmppClient extends BaseSmppClient implements SmppProvider {
  protected session: smpp.Session;
  private socket: Socket;
  protected reconnectAttempts = 0;
  protected readonly maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private enquireLinkTimer: NodeJS.Timeout | null = null;
  private statusMonitorTimer: NodeJS.Timeout | null = null;
  private isServerUnbind = false;
  private readonly STATUS_CHECK_INTERVAL = 30000; // 30秒检查一次
  private readonly MAX_STATUS_CHECK_AGE = 24 * 60 * 60 * 1000; // 24小时
  private readonly ENQUIRE_LINK_TIMEOUT = 65000; // 65秒超时
  private readonly ENQUIRE_LINK_INTERVAL = 60000; // 60秒发送一次心跳
  private lastEnquireLinkResponse: number = Date.now();
  private connectionState: {
    lastError?: Error;
    lastErrorTime?: Date;
    lastReconnectTime?: Date;
    consecutiveFailures: number;
    isReconnecting: boolean;
    lastUnbindTime?: Date;
    cooldownPeriod: number;
  } = {
    consecutiveFailures: 0,
    isReconnecting: false,
    cooldownPeriod: 0, // 取消冷却期，断开后立即重连
  };
  private sessionId: string;
  private state: string;
  private systemId: string;
  private systemType: string;
  private bindType: string;
  private addressRange: string;
  private version: string;
  private name: string;
  private config: {
    host: string;
    port: number;
    systemId: string;
    password: string;
    systemType: string;
    addressRange: string;
    enquireLinkTimer: number;
  };
  private readonly INITIAL_RECONNECT_INTERVAL = 5000; // 初始重连间隔5秒
  private readonly MAX_RECONNECT_INTERVAL = 60000; // 最大重连间隔60秒

  // 添加一个缓存来记录最近处理过的PDU，避免重复处理
  private recentPduCache: Map<string, number> = new Map();
  private readonly PDU_CACHE_EXPIRY = 60000; // 1分钟内的重复PDU将被忽略

  constructor(
    @InjectRepository(StatusReport)
    private readonly statusReportRepository: Repository<StatusReport>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    configService: ConfigService,
  ) {
    super(configService);
    this.sessionId = '';
    this.state = 'disconnected';
    this.systemId = configService.get('smpp.systemId');
    this.systemType = configService.get('smpp.systemType');
    this.bindType = configService.get('smpp.bindType');
    this.addressRange = configService.get('smpp.addressRange');
    this.version = configService.get('smpp.version');
    this.name = 'DefaultSmppClient';

    // 配置初始化
    this.config = {
      host: configService.get('smpp.host'),
      port: configService.get('smpp.port'),
      systemId: this.systemId,
      password: configService.get('smpp.password'),
      systemType: this.systemType,
      addressRange: this.addressRange,
      enquireLinkTimer: configService.get('smpp.enquireLinkTimer', 30000),
    };
  }

  async connect(): Promise<void> {
    if (this.connectionState.isReconnecting) {
      this.logger.warn('已经在进行重连，跳过本次连接请求');
      return;
    }

    this.connectionState.isReconnecting = true;

    try {
      // 清理可能存在的旧连接和定时器
      await this.cleanup();

      return new Promise((resolve, reject) => {
        const attemptConnect = () => {
          try {
            // 创建新的 Socket
            this.socket = new Socket();

            // 设置 Socket 超时
            this.socket.setTimeout(
              parseInt(process.env.SMPP_CONNECTION_TIMEOUT || '30000', 10),
            );

            // 创建 SMPP 会话
            this.session = new smpp.Session({
              socket: this.socket,
              requestTimeout: parseInt(
                process.env.SMPP_REQUEST_TIMEOUT || '45000',
                10,
              ),
            });

            // 设置 Socket 事件处理
            this.socket.on('error', (error: Error) => {
              this.logger.error(`Socket错误: ${error.message}`, error.stack);
              this.handleConnectionError(error);
            });

            this.socket.on('close', () => {
              this.logger.warn('Socket连接已关闭');
              if (!this.isServerUnbind) {
                this.handleConnectionError(new Error('Socket连接已关闭'));
              }
            });

            this.socket.on('timeout', () => {
              this.logger.error('Socket连接超时');
              this.handleConnectionError(new Error('Socket连接超时'));
            });

            // 设置 SMPP 会话事件处理
            this.session.on('error', (error: Error) => {
              this.logger.error(`SMPP会话错误: ${error.message}`, error.stack);
              this.handleConnectionError(error);
            });

            // 处理解绑请求
            this.session.on('unbind', () => {
              this.logger.log('收到服务器解绑请求');
              this.isServerUnbind = true;
              void this.doDisconnect();
            });

            // 处理绑定响应
            this.session.on('bind_transceiver_resp', (pdu: SmppPDU) => {
              if (pdu.command_status === 0) {
                this._isConnected = true;
                this.reconnectAttempts = 0;
                this.isServerUnbind = false;
                this.connectionState.consecutiveFailures = 0;
                this.connectionState.isReconnecting = false;
                this.connectionState.lastReconnectTime = new Date();
                this.logger.log('SMPP绑定成功');
                this.setupEventHandlers();
                this.state = 'connected';
                resolve();
              } else {
                const error = new Error(`SMPP绑定失败: ${pdu.command_status}`);
                this.logger.error(error.message);
                this.connectionState.isReconnecting = false;
                this.handleConnectionError(error);
                reject(error);
              }
            });

            // 处理enquire_link响应
            this.session.on('enquire_link_resp', () => {
              this.logger.debug('收到 enquire_link 响应');
              this.lastEnquireLinkResponse = Date.now();
            });

            // 连接到服务器
            this.socket.connect(this.config.port, this.config.host, () => {
              this.logger.log(
                `正在连接到SMPP服务器: ${this.config.host}:${this.config.port}`,
              );

              // 准备绑定参数
              const bindParams = {
                system_id: this.config.systemId || '',
                password: this.config.password || '',
                system_type: this.config.systemType || '',
                interface_version: 52,
                addr_ton: 0,
                addr_npi: 0,
                address_range: this.config.addressRange || '',
              };

              this.session.bind_transceiver(bindParams);
            });
          } catch (error) {
            this.connectionState.isReconnecting = false;
            this.handleConnectionError(error);
            reject(error);
          }
        };

        attemptConnect();
      });
    } catch (error) {
      this.connectionState.isReconnecting = false;
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    // 清理定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.enquireLinkTimer) {
      clearInterval(this.enquireLinkTimer);
      this.enquireLinkTimer = null;
    }
    if (this.statusMonitorTimer) {
      clearInterval(this.statusMonitorTimer);
      this.statusMonitorTimer = null;
    }

    // 清理旧连接
    if (this.session) {
      try {
        await this.doDisconnect();
      } catch (error) {
        this.logger.warn('清理旧连接时出错，继续尝试新连接');
      }
    }
  }

  protected async handleConnectionError(error: Error): Promise<void> {
    this.logger.error(
      `SMPP连接错误 [${this.name}]: ${error.message}`,
      error.stack,
    );
    this._isConnected = false;
    this.state = 'disconnected';
    this.connectionState.lastError = error;
    this.connectionState.lastErrorTime = new Date();
    this.connectionState.consecutiveFailures++;
    this.connectionState.isReconnecting = false;

    // 取消冷却期逻辑，直接重连

    // 检查是否超过最大重连次数
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `达到最大重连次数 ${this.maxReconnectAttempts}，停止重连`,
      );
      this.connectionState.isReconnecting = false;
      return;
    }

    // 计算重连间隔
    const reconnectInterval = this.getReconnectInterval();
    this.logger.log(
      `计划在 ${reconnectInterval}ms 后尝试第 ${
        this.reconnectAttempts + 1
      } 次重连 (当前reconnectAttempts=${this.reconnectAttempts})`,
    );

    // 设置重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      this.logger.log(`正在尝试第 ${this.reconnectAttempts} 次重连...`);
      try {
        await this.connect();
      } catch (error) {
        this.logger.error(`重连失败: ${error.message}`, error.stack);
        this.connectionState.isReconnecting = false;
      }
    }, reconnectInterval);
  }

  protected setupEventHandlers(): void {
    if (!this.session) return;

    // 清理旧的定时器
    if (this.enquireLinkTimer) {
      clearInterval(this.enquireLinkTimer);
      this.enquireLinkTimer = null;
    }
    if (this.statusMonitorTimer) {
      clearInterval(this.statusMonitorTimer);
      this.statusMonitorTimer = null;
    }

    // 移除可能存在的旧事件监听器（在重新绑定前）
    this.session.removeAllListeners('enquire_link_resp');

    // 设置enquire_link_resp响应监听器
    this.session.on('enquire_link_resp', () => {
      this.logger.log('收到 enquire_link 响应');
      this.lastEnquireLinkResponse = Date.now();
    });

    // 设置新的 enquire_link 定时器
    const enquireLinkInterval = 20000; // 50秒
    this.logger.log(`正在启动心跳定时器，间隔: ${enquireLinkInterval}ms`);

    this.enquireLinkTimer = setInterval(() => {
      if (this._isConnected && this.session) {
        // 检查上次enquire_link响应时间
        const now = Date.now();
        if (now - this.lastEnquireLinkResponse > this.ENQUIRE_LINK_TIMEOUT) {
          this.logger.warn(
            `Enquire link超时: ${now - this.lastEnquireLinkResponse}ms无响应`,
          );
          void this.handleConnectionError(new Error('Enquire link timeout'));
          return;
        }

        this.logger.log('发送 enquire_link 心跳包');
        try {
          // 正确使用SMPP库的enquire_link方法，使用回调而非Promise
          this.session.enquire_link((pdu) => {
            if (pdu && pdu.command_status !== 0) {
              this.logger.error(
                `Enquire link响应错误: 状态码 ${pdu.command_status}`,
              );
            }
          });
        } catch (error) {
          this.logger.error(`Enquire link发送异常: ${error.message}`);
        }
      } else {
        this.logger.warn('跳过心跳发送: 连接未建立或会话无效');
      }
    }, enquireLinkInterval);

    this.logger.log(`心跳定时器已启动，间隔：${enquireLinkInterval}ms`);

    // 设置消息状态监控定时器
    this.statusMonitorTimer = setInterval(() => {
      void this.checkQueuedMessages().catch((error) => {
        this.logger.error(`检查队列消息失败: ${error.message}`);
      });
    }, this.STATUS_CHECK_INTERVAL);

    // 处理状态报告
    this.session.on('deliver_sm', (pdu: SmppPDU) => {
      void this.handleDeliverSm(pdu).catch((error) => {
        this.logger.error(`处理状态报告失败: ${error.message}`, error.stack);
      });
    });
  }

  protected async doSendMessage(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const results = await Promise.all(
      (params.phoneNumbers || [params.phoneNumber]).map(async (phoneNumber) => {
        try {
          const result = await this.submitSm({
            source_addr: params.senderId || this.config.systemId,
            destination_addr: phoneNumber,
            short_message: params.content,
            schedule_delivery_time: params.scheduleTime
              ? this.formatSmppTime(params.scheduleTime)
              : undefined,
          });
          this.logger.log(
            `[SMPP响应] 提交resp: phone=${phoneNumber}, smppMessageId=${result.message_id}, status=${result.command_status}`,
          );
          const messageResult: MessageResult = {
            messageId: result.message_id || '',
            phoneNumber,
            orderId: params.orderId,
            status: result.command_status === 0 ? 'success' : 'failed',
            errorMessage:
              result.command_status === 0
                ? undefined
                : `错误码: ${result.command_status}`,
          };
          return messageResult;
        } catch (error) {
          const smppError = error as Error;
          const messageResult: MessageResult = {
            messageId: '',
            phoneNumber,
            orderId: params.orderId,
            status: 'failed',
            errorMessage: smppError.message,
          };
          this.logger.error(
            `[SMPP响应] 提交resp失败: phone=${phoneNumber}, error=${smppError.message}`,
          );
          return messageResult;
        }
      }),
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    return {
      status: successCount > 0 ? 'success' : 'failed',
      messageId: results.length > 0 ? results[0].messageId : '',
      successCount,
      failCount: results.length - successCount,
      messageResults: results,
    };
  }

  protected async doQueryMessageStatus(
    messageId: string,
  ): Promise<MessageStatusResponse> {
    try {
      const message = await this.messageRepository.findOne({
        where: { messageId },
      });

      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }

      const statusReport = await this.statusReportRepository.findOne({
        where: { messageId: message.messageId },
        order: { id: 'DESC' },
      });

      if (statusReport) {
        return {
          messageId,
          phoneNumber: message.phoneNumber,
          status: this.convertStatusToProviderStatus(statusReport.status),
          deliveredAt: statusReport.deliveredAt?.toISOString(),
          errorMessage: statusReport.errorMessage,
        };
      }

      // If no status report found, return current message status
      return {
        messageId,
        phoneNumber: message.phoneNumber,
        status: this.mapMessageStatusToProviderStatus(message.status),
        deliveredAt: message.updateTime?.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to query message status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  protected convertStatusToProviderStatus(status: string): ProviderStatus {
    switch (status.toUpperCase()) {
      case 'DELIVRD':
        return ProviderStatusEnum.DELIVERED;
      case 'UNDELIV':
      case 'REJECTD':
      case 'FAILED':
      case 'ERROR':
        return ProviderStatusEnum.FAILED;
      case 'EXPIRED':
        return ProviderStatusEnum.EXPIRED;
      case 'ACCEPTD':
      case 'ENROUTE':
      case 'UNKNOWN':
        return ProviderStatusEnum.PENDING;
      default:
        return ProviderStatusEnum.PENDING;
    }
  }

  protected mapMessageStatusToProviderStatus(
    messageStatus: MessageStatus,
  ): ProviderStatus {
    switch (messageStatus) {
      case MessageStatusEnum.DELIVERED:
        return ProviderStatusEnum.DELIVERED;
      case MessageStatusEnum.FAILED:
      case MessageStatusEnum.ERROR:
        return ProviderStatusEnum.FAILED;
      case MessageStatusEnum.PENDING:
      case MessageStatusEnum.QUEUED:
      case MessageStatusEnum.SENDING:
      case MessageStatusEnum.PROCESSING:
        return ProviderStatusEnum.PENDING;
      default:
        return ProviderStatusEnum.PENDING;
    }
  }

  async getBalance(): Promise<BalanceInfo> {
    // 通常需要通过特定的API或其他方式获取余额
    // 这里返回一个模拟值
    return {
      balance: 1000,
      amount: 1000,
      currency: 'CNY',
    };
  }

  protected isConnectionError(error: unknown): boolean {
    const err = error as Error;
    return (
      err instanceof Error &&
      ('code' in err || err.message.toLowerCase().includes('connection'))
    );
  }

  private submitSm(params: Record<string, unknown>): Promise<SmppPDU> {
    return new Promise((resolve, reject) => {
      const smppParams: any = {
        ...params,
        source_addr_ton: 0,
        source_addr_npi: 0,
        dest_addr_ton: 1, // 默认为国际格式
        dest_addr_npi: 1,
        data_coding: 0,
        registered_delivery: 1,
      };

      // 处理电话号码格式
      if (typeof smppParams.destination_addr === 'string') {
        const phoneNumber = smppParams.destination_addr;

        // 检查号码是否带有加号前缀
        if (phoneNumber.startsWith('+')) {
          // 号码带加号，设置为国际格式(TON=1)并保留加号
          smppParams.dest_addr_ton = 1; // 国际格式
          // 保留原始带加号的格式
          this.logger.debug(`使用国际格式号码(带加号): ${phoneNumber}`);
        } else if (/^\d{8,15}$/.test(phoneNumber)) {
          // 纯数字号码，检查长度判断是否为国际格式
          if (phoneNumber.length > 10) {
            // 可能是国际格式，但不带加号
            smppParams.dest_addr_ton = 1; // 国际格式
            this.logger.debug(`使用国际格式号码(不带加号): ${phoneNumber}`);
          } else {
            // 可能是本地号码
            smppParams.dest_addr_ton = 0; // 未知格式
            this.logger.debug(`使用本地格式号码: ${phoneNumber}`);
          }
        } else {
          // 其他格式，使用默认设置
          this.logger.debug(`使用默认格式号码: ${phoneNumber}`);
        }
      }

      // 删除所有 undefined 字段
      Object.keys(smppParams).forEach(
        (key) => smppParams[key] === undefined && delete smppParams[key],
      );

      // 处理 short_message
      if (typeof smppParams.short_message === 'string') {
        try {
          smppParams.short_message = Buffer.from(
            smppParams.short_message,
            'utf8',
          );
          this.logger.debug('消息内容已转换为 Buffer:', {
            length: smppParams.short_message.length,
            content: smppParams.short_message.toString('utf8'),
          });
        } catch (error) {
          this.logger.error(`消息内容转换失败: ${error.message}`, error.stack);
          reject(error);
          return;
        }
      }

      this.logger.debug('submit_sm 参数:', {
        ...smppParams,
        short_message: smppParams.short_message?.toString('utf8'),
      });

      this.session.submit_sm(smppParams, (pdu: SmppPDU) => {
        if (pdu.command_status === 0) {
          resolve(pdu);
        } else {
          reject(new Error(`发送失败: ${pdu.command_status}`));
        }
      });
    });
  }

  private async handleDeliverSm(pdu: SmppPDU): Promise<void> {
    this.logger.warn(`[调试] 收到 deliver_sm PDU: ${JSON.stringify(pdu)}`);

    // 处理状态报告
    if (pdu.esm_class === 0x04) {
      // 生成一个哈希值作为PDU的唯一标识
      const pduContent = pdu.short_message?.message || '';
      const pduHash = `${pduContent}-${pdu.sequence_number}`;

      // 检查是否为最近处理过的相同PDU
      const lastSeen = this.recentPduCache.get(pduHash);
      const now = Date.now();

      if (lastSeen && now - lastSeen < this.PDU_CACHE_EXPIRY) {
        this.logger.warn(
          `忽略重复的 deliver_sm PDU: ${pduHash}，上次处理时间: ${new Date(
            lastSeen,
          ).toISOString()}`,
        );
      } else {
        // 记录该PDU
        this.recentPduCache.set(pduHash, now);

        // 清理过期的缓存条目
        this.cleanupPduCache();

        // 处理状态报告
        await this.handleDeliveryReport(pdu);
      }
    }

    // 不管是否处理，都要回复SMPP服务器
    this.session.deliver_sm_resp({
      command_status: 0,
      sequence_number: pdu.sequence_number,
    });
  }

  /**
   * 清理过期的PDU缓存
   */
  private cleanupPduCache(): void {
    const now = Date.now();
    const expiredTime = now - this.PDU_CACHE_EXPIRY;

    for (const [hash, timestamp] of this.recentPduCache.entries()) {
      if (timestamp < expiredTime) {
        this.recentPduCache.delete(hash);
      }
    }
  }

  private async handleDeliveryReport(pdu: SmppPDU): Promise<void> {
    try {
      // 1. 解析状态报告
      const messageContent = pdu.short_message?.message || '';
      const [messageId, stat, err] = this.parseDeliveryReport(messageContent);

      if (!messageId) {
        this.logger.warn('状态报告中没有 message_id');
        return;
      }

      // 2. 转换状态
      const status = this.convertStatusToProviderStatus(stat);
      const errorCode = err || '000';

      // 记录错误码解释
      let errorCodeDescription = '未知错误';
      switch (errorCode) {
        case '000':
          errorCodeDescription = '无错误';
          break;
        case '001':
          errorCodeDescription = '未知订阅者';
          break;
        case '020':
          errorCodeDescription = '格式错误或无效号码格式 (可能缺少区号)';
          break;
        case '046':
          errorCodeDescription = '数据丢失或数据验证失败';
          break;
        default:
          errorCodeDescription = `未知错误码: ${errorCode}`;
      }

      if (errorCode !== '000') {
        this.logger.warn(
          `SMPP错误码: ${errorCode} - ${errorCodeDescription}, 状态: ${stat}`,
        );
      }

      // 3. 查找消息记录（带重试机制）
      let message = await this.findMessageByProviderId(messageId);
      if (!message) {
        // 等待1秒后重试
        await new Promise((resolve) => setTimeout(resolve, 1000));
        message = await this.findMessageByProviderId(messageId);
      }

      if (!message) {
        this.logger.error(
          `找不到对应的消息记录: provider_message_id=${messageId}`,
        );
        return;
      }

      // 4. 更新消息状态
      await this.updateMessageStatus(message.messageId, {
        status,
        errorCode,
        deliveredAt: new Date(),
      });

      // 5. 记录状态报告
      await this.recordStatusReport(message, {
        providerMessageId: messageId,
        status,
        errorCode,
        stat,
        deliveredAt: new Date(),
      });

      this.logger.log(
        `[状态报告] messageId=${messageId}, stat=${stat}, status=${status}, err=${errorCode}(${errorCodeDescription}), deliveredAt=${new Date().toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`处理状态报告失败: ${error.message}`, error.stack);
    }
  }

  private async findMessageByProviderId(
    providerMessageId: string,
  ): Promise<Message | null> {
    try {
      return await this.messageRepository.findOne({
        where: { providerMessageId },
      });
    } catch (error) {
      this.logger.error(`查找消息失败: ${error.message}`);
      return null;
    }
  }

  private parseDeliveryReport(message: string): [string, string, string] {
    const messageIdMatch = message.match(/id:(\d+)/);
    const statMatch = message.match(/stat:([A-Z]+)/);
    const errMatch = message.match(/err:(\d+)/);

    return [
      messageIdMatch ? messageIdMatch[1] : '',
      statMatch ? statMatch[1] : '',
      errMatch ? errMatch[1] : '000',
    ];
  }

  private async recordStatusReport(
    message: Message,
    report: {
      providerMessageId: string;
      status: ProviderStatus;
      errorCode: string;
      stat: string;
      deliveredAt: Date;
    },
  ): Promise<void> {
    try {
      // 查找是否已存在相同记录，只通过messageId和providerMessageId查询，不包括status
      const existingReport = await this.statusReportRepository.findOne({
        where: {
          messageId: message.messageId,
          providerMessageId: report.providerMessageId,
        },
      });

      if (existingReport) {
        // 检查状态优先级，决定是否更新
        const shouldUpdate = this.shouldUpdateStatus(
          existingReport.status,
          report.status,
        );
        if (shouldUpdate) {
          await this.statusReportRepository.update(
            { id: existingReport.id },
            {
              status: report.status,
              errorCode: report.errorCode,
              errorMessage: `SMPP状态: ${report.stat}`,
              deliveredAt: report.deliveredAt,
              receivedAt: new Date(),
              rawData: JSON.stringify(report),
            },
          );
          this.logger.log(
            `更新现有状态报告: messageId=${message.messageId}, providerMessageId=${report.providerMessageId}, 状态从${existingReport.status}更新为${report.status}`,
          );
        } else {
          this.logger.log(
            `保留现有状态报告(优先级更高): messageId=${message.messageId}, providerMessageId=${report.providerMessageId}, 当前状态=${existingReport.status}, 收到状态=${report.status}`,
          );
        }
      } else {
        // 插入新记录
        await this.statusReportRepository.save({
          messageId: message.messageId,
          phoneNumber: message.phoneNumber,
          providerId: this.name,
          providerMessageId: report.providerMessageId,
          status: report.status,
          errorCode: report.errorCode,
          errorMessage: `SMPP状态: ${report.stat}`,
          deliveredAt: report.deliveredAt,
          receivedAt: new Date(),
          rawData: JSON.stringify(report),
        });
        this.logger.log(
          `新增状态报告: messageId=${message.messageId}, providerMessageId=${report.providerMessageId}`,
        );
      }
    } catch (error) {
      this.logger.error(`记录状态报告失败: ${error.message}`);
    }
  }

  /**
   * 判断是否应该更新状态
   * @param currentStatus 当前状态
   * @param newStatus 新状态
   * @returns 如果新状态优先级高于当前状态，返回true
   */
  private shouldUpdateStatus(
    currentStatus: ProviderStatus,
    newStatus: ProviderStatus,
  ): boolean {
    const priorityMap = {
      FAILED: 1, // 最高优先级
      DELIVERED: 2,
      EXPIRED: 3,
      PENDING: 4, // 最低优先级
    };

    // 新状态优先级值更小(优先级更高)，则应该更新
    return priorityMap[newStatus] < priorityMap[currentStatus];
  }

  protected async updateMessageStatus(
    messageId: string,
    status: {
      status: ProviderStatus;
      deliveredAt: Date;
      errorCode?: string;
      stat?: string;
      rawData?: string;
    },
  ): Promise<void> {
    try {
      const message = await this.messageRepository.findOne({
        where: { messageId },
      });

      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }

      // Convert provider status to message status
      const messageStatus = this.mapProviderStatusToMessageStatus(
        status.status,
      );
      const oldStatus = message.status;

      // 检查状态优先级，决定是否更新
      const shouldUpdate = this.shouldUpdateMessageStatus(
        oldStatus,
        messageStatus,
      );

      if (shouldUpdate) {
        // Update message status
        await this.messageRepository.update({ messageId }, {
          status: messageStatus,
          updateTime: status.deliveredAt,
          errorMessage: status.stat ? status.stat : undefined,
        } as Partial<Message>);
        this.logger.log(
          `[状态变更] messageId=${messageId}, phone=${message.phoneNumber}, from=${oldStatus}, to=${messageStatus}`,
        );
      } else {
        this.logger.log(
          `[状态保持] messageId=${messageId}, phone=${message.phoneNumber}, 当前状态=${oldStatus}(优先级高于${messageStatus})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update message status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 判断是否应该更新消息状态
   * @param currentStatus 当前状态
   * @param newStatus 新状态
   * @returns 如果新状态优先级高于当前状态，返回true
   */
  private shouldUpdateMessageStatus(
    currentStatus: MessageStatus,
    newStatus: MessageStatus,
  ): boolean {
    const priorityMap = {
      FAILED: 1, // 最高优先级
      ERROR: 1, // 与FAILED同优先级
      DELIVERED: 2,
      EXPIRED: 3,
      SENDING: 4,
      PROCESSING: 5,
      QUEUED: 6,
      PENDING: 7, // 最低优先级
    };

    // 新状态优先级更高(数值更小)，则应该更新
    return priorityMap[newStatus] < priorityMap[currentStatus];
  }

  protected mapProviderStatusToMessageStatus(
    providerStatus: ProviderStatus,
  ): MessageStatus {
    switch (providerStatus) {
      case 'DELIVERED':
        return MessageStatusEnum.DELIVERED;
      case 'FAILED':
        return MessageStatusEnum.FAILED;
      case 'EXPIRED':
        return MessageStatusEnum.EXPIRED;
      default:
        return MessageStatusEnum.PENDING;
    }
  }

  protected convertMessageState(state: number): ProviderStatus {
    switch (state) {
      case 2: // DELIVERED
        return 'DELIVERED';
      case 3: // EXPIRED
        return 'EXPIRED';
      case 8: // REJECTED
      case 9: // UNDELIVERABLE
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private formatSmppTime(date: Date): string {
    // 格式化为SMPP时间格式: YYMMDDhhmmsstnnp
    return (
      date
        .toISOString()
        .replace(/[-T:.Z]/g, '')
        .slice(2, 16) + '000+'
    );
  }

  protected async doDisconnect(): Promise<void> {
    this.logger.log('SMPP解绑成功');
    this._isConnected = false;
    this.state = 'disconnected';
    this.connectionState.lastUnbindTime = new Date();
    this.isServerUnbind = true;

    // 清理定时器
    if (this.enquireLinkTimer) {
      clearInterval(this.enquireLinkTimer);
      this.enquireLinkTimer = null;
    }

    if (this.statusMonitorTimer) {
      clearInterval(this.statusMonitorTimer);
      this.statusMonitorTimer = null;
    }

    // 关闭会话
    if (this.session) {
      try {
        await this.session.close();
      } catch (error) {
        this.logger.error(`关闭会话失败: ${error.message}`, error.stack);
      }
    }

    // 关闭Socket
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (error) {
        this.logger.error(`关闭Socket失败: ${error.message}`, error.stack);
      }
    }
  }

  private async checkQueuedMessages(): Promise<void> {
    if (!this._isConnected) {
      this.logger.warn('SMPP连接未建立，跳过队列消息检查');
      return;
    }

    try {
      // 查找所有处于QUEUED状态且创建时间在24小时内的消息
      const queuedMessages = await this.messageRepository.find({
        where: {
          status: MessageStatusEnum.QUEUED,
          createdAt: MoreThan(new Date(Date.now() - this.MAX_STATUS_CHECK_AGE)),
        },
        order: {
          createdAt: 'ASC',
        },
        take: 100, // 每次最多处理100条
      });

      if (queuedMessages.length === 0) {
        return;
      }

      this.logger.log(`发现 ${queuedMessages.length} 条待处理的队列消息`);

      for (const message of queuedMessages) {
        try {
          // 查询消息状态
          const providerStatus = await this.doQueryMessageStatus(
            message.messageId,
          );

          // 将提供商状态映射到系统状态
          const newStatus = this.mapProviderStatusToMessageStatus(
            providerStatus.status,
          );

          // 如果状态有变化，更新消息状态
          if (newStatus !== message.status) {
            const updateData = {
              status: newStatus,
              updateTime: new Date(),
              errorMessage: providerStatus.errorMessage,
            };

            await this.messageRepository.update(
              { messageId: message.messageId },
              updateData,
            );

            this.logger.log(
              `消息 ${message.messageId} 状态已更新: ${newStatus}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `检查消息 ${message.messageId} 状态时出错: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`检查队列消息时出错: ${error.message}`);
    }
  }

  protected async handleStatusReport(pdu: smpp.PDU): Promise<void> {
    try {
      const messageId = pdu.message_id;
      if (!messageId) {
        this.logger.warn('Received status report without message ID');
        return;
      }

      const status = this.convertMessageState(pdu.message_state || 0);
      const deliveredAt = pdu.final_date
        ? new Date(pdu.final_date)
        : new Date();

      // 更新消息状态
      await this.updateMessageStatus(messageId, {
        status,
        deliveredAt,
      });
    } catch (error) {
      const smppError = error as Error;
      this.logger.error(
        `处理状态报告失败: ${smppError.message}`,
        smppError.stack,
      );
    }
  }

  /**
   * 获取重连间隔时间（使用指数退避策略）
   */
  private getReconnectInterval(): number {
    // 固定重连间隔1秒
    return 1000;
  }

  getProviderId(): string {
    return this.name;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getState(): string {
    return this.state;
  }

  getSystemId(): string {
    return this.systemId;
  }

  getSystemType(): string {
    return this.systemType;
  }

  getBindType(): string {
    return this.bindType;
  }

  getAddressRange(): string {
    return this.addressRange;
  }

  getVersion(): string {
    return this.version || '5.0';
  }
}
