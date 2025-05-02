import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { ProviderService } from '../services/provider.service';
import { SendMessageParams } from '../provider/interfaces/provider.interface';
import { ConfigService } from '@nestjs/config';
import { BalanceService } from '../services/balance.service';

@Injectable()
export class SmsQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(SmsQueueConsumer.name);
  private readonly BATCH_SIZE = 100; // 每批处理的号码数量

  constructor(
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
    private readonly balanceService: BalanceService,
  ) {}

  async onModuleInit() {
    await this.setupConsumer();
  }

  private async setupConsumer() {
    try {
      const topic = this.configService.get('kafka.topics.smsRequests');
      this.logger.log(`注册消息处理器，主题: ${topic}`);

      this.kafkaConsumer.registerHandler(topic, async (message) => {
        try {
          this.logger.debug(`收到消息: ${JSON.stringify(message)}`);
          const params: SendMessageParams = message;

          // 在发送短信前扣除余额
          const pricePerSms = 0.042;
          const totalAmount = params.phoneNumbers.length * pricePerSms;
          this.logger.debug(
            `[扣费调试] 即将扣除余额: appId=${message.appId}, amount=${totalAmount}`,
          );

          await this.balanceService.deductBalance(
            message.appId,
            totalAmount,
            '短信发送扣费',
          );
          this.logger.debug(`[扣费调试] 扣除余额完成: appId=${message.appId}`);

          // 将号码分组处理
          const batches = [];
          for (
            let i = 0;
            i < params.phoneNumbers.length;
            i += this.BATCH_SIZE
          ) {
            const batch = params.phoneNumbers.slice(i, i + this.BATCH_SIZE);
            batches.push(
              this.providerService.sendMessage({
                ...params,
                phoneNumbers: batch,
              }),
            );
          }

          // 并发处理所有批次
          const results = await Promise.all(batches);

          // 统计结果
          const totalSuccess = results.reduce(
            (sum, result) => sum + result.successCount,
            0,
          );
          const totalFail = results.reduce(
            (sum, result) => sum + result.failCount,
            0,
          );

          this.logger.debug(
            `消息处理完成: 成功=${totalSuccess}, 失败=${totalFail}`,
          );
        } catch (error) {
          this.logger.error(`消息处理失败: ${error.message}`, error.stack);
          // 这里可以添加重试逻辑或死信队列处理
        }
      });
    } catch (error) {
      this.logger.error(`设置消费者失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
