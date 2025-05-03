import { SmppProvider } from './provider.interface';
import { StatusReport } from '../../entities/status-report.entity';

/**
 * SMPP客户端服务接口
 * 定义了SMPP客户端服务的公共方法，用于管理SMPP连接和消息发送
 */
export interface ISmppClientService {
  /**
   * 初始化SMPP客户端
   */
  initialize(): Promise<void>;

  /**
   * 获取SMPP客户端提供商实例
   * @param providerId 提供商ID，如果未指定则使用当前激活的提供商
   */
  getClient(providerId?: string): Promise<SmppProvider | undefined>;

  /**
   * 获取当前激活的提供商ID
   */
  getActiveProviderId(): string | null;

  /**
   * 切换激活的提供商
   * @param providerId 要切换到的提供商ID
   */
  switchActiveProvider(providerId: string): Promise<boolean>;

  /**
   * 获取所有已初始化的提供商客户端
   * 注意：此方法返回Map，但在StatusController中被当作数组使用
   * 所以需要在实现中确保返回的是数组或者在Controller中进行转换
   */
  getAllClients(): Map<string, SmppProvider>;

  /**
   * 查询消息状态 (用于ProviderService)
   * @param messageId 消息ID
   * @param providerId 提供商ID，如果未指定则使用当前激活的提供商
   */
  queryMessageStatus(
    messageId: string,
    providerId?: string,
  ): Promise<string | null>;

  /**
   * 测试所有SMPP连接
   */
  testConnections(): Promise<Map<string, boolean>>;

  /**
   * 获取消息状态 (用于StatusController)
   * @param messageId 消息ID
   */
  getMessageStatus(messageId: string): Promise<StatusReport>;

  /**
   * 获取消息统计数据 (用于StatusController)
   */
  getMessageStats(): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }>;
}
