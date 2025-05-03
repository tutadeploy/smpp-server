import { QueueMessage } from './queue.interface';

/**
 * 短信队列服务接口
 * 负责处理短信队列相关的业务逻辑
 */
export interface ISmsQueueService {
  /**
   * 处理队列中的短信消息
   * @param message 队列消息
   */
  processQueuedMessage(message: QueueMessage): Promise<boolean>;

  /**
   * 批量处理队列中的短信消息
   * @param messages 队列消息数组
   */
  processBatchMessages(messages: QueueMessage[]): Promise<{
    success: number;
    fail: number;
  }>;

  /**
   * 重试发送失败的消息
   * @param messageId 消息ID
   */
  retryFailedMessage(messageId: string): Promise<boolean>;
}
