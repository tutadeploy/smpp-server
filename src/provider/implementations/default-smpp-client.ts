import { Injectable } from '@nestjs/common';
import * as smpp from 'smpp';
import { Socket } from 'net';
import { BaseSmppClient } from '../base/smpp-client.base';
import { SmppSessionConfig } from '../interfaces/smpp-session.interface';
import {
  SendMessageParams,
  SendMessageResult,
  BalanceInfo,
  MessageStatus,
  MessageResult,
} from '../interfaces/provider.interface';

interface SmppPDU {
  command_status: number;
  message_id?: string;
  sequence_number?: number;
  message_state?: number;
  final_date?: string;
  destination_addr?: string;
  esm_class?: number;
}

@Injectable()
export class DefaultSmppClient extends BaseSmppClient {
  protected session: smpp.Session;
  private socket: Socket;
  protected reconnectAttempts = 0;
  protected readonly maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private enquireLinkTimer: NodeJS.Timeout | null = null;
  private isServerUnbind = false;

  constructor(name: string, config: SmppSessionConfig) {
    super(name, config);
  }

  protected async connect(): Promise<void> {
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
            this.isConnected = false;
            this.handleConnectionError();
          });

          this.socket.on('close', () => {
            this.logger.warn('Socket连接已关闭');
            this.isConnected = false;
            if (!this.isServerUnbind) {
              this.handleConnectionError();
            }
          });

          this.socket.on('timeout', () => {
            this.logger.error('Socket连接超时');
            this.isConnected = false;
            this.handleConnectionError();
          });

          // 设置 SMPP 会话事件处理
          this.session.on('error', (error: Error) => {
            this.logger.error(`SMPP会话错误: ${error.message}`, error.stack);
            this.isConnected = false;
            this.handleConnectionError();
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
              this.isConnected = true;
              this.reconnectAttempts = 0; // 重置重连计数
              this.isServerUnbind = false;
              this.logger.log('SMPP绑定成功');
              this.setupEventHandlers();
              resolve();
            } else {
              const error = new Error(`SMPP绑定失败: ${pdu.command_status}`);
              this.logger.error(error.message);
              reject(error);
            }
          });

          // 连接到服务器
          this.socket.connect(this.config.port, this.config.host, () => {
            this.logger.log(
              `正在连接到SMPP服务器: ${this.config.host}:${this.config.port}`,
            );
            this.logger.log('Socket连接已建立，正在进行SMPP绑定...');

            // 准备绑定参数，确保所有必需参数都有值
            const bindParams = {
              system_id: this.config.systemId || '',
              password: this.config.password || '',
              system_type: this.config.systemType || '',
              interface_version: 52,
              addr_ton: 0,
              addr_npi: 0,
              address_range: this.config.addressRange || '',
            };

            this.logger.debug('SMPP绑定参数:', {
              ...bindParams,
              password: '******', // 不记录实际密码
            });

            this.session.bind_transceiver(bindParams);
          });
        } catch (error) {
          reject(error);
        }
      };

      attemptConnect();
    });
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

    // 清理旧连接
    if (this.session) {
      try {
        await this.doDisconnect();
      } catch (error) {
        this.logger.warn('清理旧连接时出错，继续尝试新连接');
      }
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // 使用更长的初始重连间隔，从10秒开始
      const delay = Math.min(
        10000 * Math.pow(1.5, this.reconnectAttempts),
        60000,
      ); // 更平缓的指数退避，最大60秒
      this.logger.log(
        `将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连尝试`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.isServerUnbind = false; // 重置服务器断开标志
        void this.connect();
      }, delay);
    } else {
      this.logger.error(
        `已达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`,
      );
    }
  }

  protected setupEventHandlers(): void {
    if (!this.session) return;

    // 清理旧的 enquire_link 定时器
    if (this.enquireLinkTimer) {
      clearInterval(this.enquireLinkTimer);
    }

    // 设置新的 enquire_link 定时器，间隔改为10秒
    this.enquireLinkTimer = setInterval(() => {
      if (this.isConnected) {
        this.session.enquire_link();
      }
    }, 10000);

    this.session.on('deliver_sm', (pdu: SmppPDU) => {
      void this.handleDeliverSm(pdu);
    });
  }

  protected async doSendMessage(
    params: SendMessageParams,
  ): Promise<SendMessageResult> {
    const results = await Promise.all(
      params.phoneNumbers.map(async (phoneNumber) => {
        try {
          const result = await this.submitSm({
            source_addr: params.senderId || this.config.systemId,
            destination_addr: phoneNumber,
            short_message: params.content,
            schedule_delivery_time: params.scheduleTime
              ? this.formatSmppTime(params.scheduleTime)
              : undefined,
          });

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
          return messageResult;
        }
      }),
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    return {
      successCount,
      failCount: results.length - successCount,
      messageResults: results,
    };
  }

  protected async doQueryMessageStatus(
    messageId: string,
  ): Promise<MessageStatus> {
    return new Promise((resolve, reject) => {
      this.session.query_sm(
        {
          message_id: messageId,
          source_addr: this.config.systemId,
        },
        (pdu: SmppPDU) => {
          if (pdu.command_status === 0) {
            resolve({
              messageId,
              phoneNumber: pdu.destination_addr || '',
              status: this.convertMessageState(pdu.message_state || 0),
              deliveredAt: pdu.final_date
                ? new Date(pdu.final_date).toISOString()
                : undefined,
            });
          } else {
            reject(new Error(`查询状态失败: ${pdu.command_status}`));
          }
        },
      );
    });
  }

  async getBalance(): Promise<BalanceInfo> {
    // 通常需要通过特定的API或其他方式获取余额
    // 这里返回一个模拟值
    return {
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
        source_addr_ton: 0, // 源地址类型
        source_addr_npi: 0, // 源地址编号方案
        dest_addr_ton: 1, // 目标地址类型(1=国际号码)
        dest_addr_npi: 1, // 目标地址编号方案(1=E.164)
        data_coding: 0, // 默认编码
        registered_delivery: 1, // 请求状态报告
      };
      // 删除所有 undefined 字段
      Object.keys(smppParams).forEach(
        (key) => smppParams[key] === undefined && delete smppParams[key],
      );
      // 明确处理 short_message
      if (typeof smppParams.short_message === 'string') {
        smppParams.short_message = Buffer.from(
          smppParams.short_message,
          'utf8',
        );
      }
      this.logger.debug('submit_sm 参数:', smppParams);
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
    // 处理状态报告
    if (pdu.esm_class === 0x04) {
      await this.handleDeliveryReport(pdu);
    }

    // 回复SMPP服务器
    this.session.deliver_sm_resp({
      command_status: 0,
      sequence_number: pdu.sequence_number,
    });
  }

  private async handleDeliveryReport(pdu: SmppPDU): Promise<void> {
    try {
      const messageId = pdu.message_id || '';
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

  protected async updateMessageStatus(
    messageId: string,
    status: { status: string; deliveredAt: Date },
  ): Promise<void> {
    // 实现消息状态更新逻辑
    this.logger.debug(`更新消息状态: ${messageId} -> ${status.status}`);
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
    if (this.session) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.session.unbind();
          this.session.on('unbind_resp', () => {
            this.logger.log('SMPP解绑成功');
            if (this.socket) {
              this.socket.end();
            }
            resolve();
          });
          this.session.on('error', reject);
        });
      } finally {
        this.session = null;
        this.socket = null;
      }
    } else if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}
