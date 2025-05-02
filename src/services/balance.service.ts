import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Transaction, TransactionType } from '../entities/transaction.entity';
import { BalanceResponseDto } from '../api/dto/response.dto';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 检查账户余额是否足够
   * @param appId 应用ID
   * @param messageCount 消息数量
   * @returns 余额是否足够
   */
  async checkBalance(appId: string, messageCount: number): Promise<boolean> {
    try {
      const account = await this.accountRepository.findOne({
        where: { appId },
      });
      if (!account) {
        throw new Error(`账户不存在: ${appId}`);
      }

      // 统一计费：每条短信0.042元
      const requiredBalance = messageCount * 0.042;
      return account.balance >= requiredBalance;
    } catch (error) {
      this.logger.error(`检查余额失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 扣除账户余额
   * @param appId 应用ID
   * @param amount 扣减数量
   * @param description 交易描述
   */
  async deductBalance(
    appId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    try {
      await this.accountRepository.manager.transaction(async (manager) => {
        // 查询账户并锁定
        const account = await manager
          .createQueryBuilder(Account, 'account')
          .setLock('pessimistic_write')
          .where('account.appId = :appId', { appId })
          .getOne();

        if (!account) {
          throw new Error(`账户不存在: ${appId}`);
        }

        if (account.balance < amount) {
          throw new Error(`账户余额不足: ${appId}`);
        }

        // 更新余额
        account.balance -= amount;
        await manager.save(account);

        // 记录交易
        const transaction = manager.create(Transaction, {
          accountId: account.id,
          appId: account.appId,
          amount: -amount,
          balance: account.balance,
          balanceAfter: account.balance,
          creditUsed: account.creditUsed,
          creditUsedAfter: account.creditUsed,
          type: 'DEDUCT',
          description,
        });
        await manager.save(transaction);

        this.logger.debug(
          `账户 ${appId} 扣除余额 ${amount}, 当前余额: ${account.balance}`,
        );
      });
    } catch (error) {
      this.logger.error(`扣除余额失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 查询账户余额
   * @param appId 应用ID
   * @returns 账户余额
   */
  async getBalance(appId: string): Promise<number> {
    try {
      const account = await this.accountRepository.findOne({
        where: { appId },
      });
      if (!account) {
        throw new Error(`账户不存在: ${appId}`);
      }
      return account.balance;
    } catch (error) {
      this.logger.error(`获取余额失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取账户余额
   * @param appId 应用ID
   * @returns 账户余额
   */
  async getBalanceDto(appId: string): Promise<BalanceResponseDto> {
    try {
      const account = await this.accountRepository.findOne({
        where: { appId },
      });

      if (!account) {
        return {
          status: '1',
          reason: 'Account not found',
          balance: '0',
          gift: '0',
          credit: '0',
        };
      }

      return {
        status: '0',
        reason: 'success',
        balance: account.balance.toString(),
        gift: account.giftBalance.toString(),
        credit: account.creditLimit.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get balance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 充值账户余额
   * @param appId 应用ID
   * @param amount 充值金额
   * @param description 交易描述
   */
  async rechargeBalance(
    appId: string,
    amount: number,
    description: string,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug(`开始充值 [${appId}], 金额: ${amount}`);

      // 查询账户并锁定
      const account = await queryRunner.manager
        .createQueryBuilder(Account, 'account')
        .setLock('pessimistic_write')
        .where('account.appId = :appId', { appId })
        .getOne();

      if (!account) {
        throw new Error(`账户不存在: ${appId}`);
      }

      this.logger.debug(`账户 [${appId}] 当前余额: ${account.balance}`);

      // 更新余额
      const oldBalance = Number(account.balance);
      account.balance = Number(account.balance) + Number(amount);
      await queryRunner.manager.save(account);

      this.logger.debug(`账户 [${appId}] 更新后余额: ${account.balance}`);

      // 创建交易记录
      const transaction = new Transaction();
      transaction.accountId = account.id;
      transaction.appId = appId;
      transaction.amount = amount;
      transaction.type = 'RECHARGE';
      transaction.description = description;
      transaction.balance = oldBalance; // 交易前余额
      transaction.balanceAfter = account.balance; // 交易后余额
      await queryRunner.manager.save(transaction);

      this.logger.debug(`创建交易记录 [${appId}], 金额: ${amount}`);

      // 提交事务
      await queryRunner.commitTransaction();
      this.logger.debug(`充值成功 [${appId}], 金额: ${amount}`);
      return true;
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `充值余额失败 [${appId}]: ${error.message}`,
        error.stack,
      );
      return false;
    } finally {
      // 释放连接
      await queryRunner.release();
    }
  }

  async addBalance(
    appId: string,
    amount: number,
    type: TransactionType,
    description: string,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 查询账户信息
      const account = await queryRunner.manager.findOne(Account, {
        where: { appId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // 增加余额
      if (type === 'RECHARGE') {
        account.balance = Number(account.balance) + Number(amount);
      } else if (type === 'GIFT') {
        account.giftBalance = Number(account.giftBalance) + Number(amount);
      }

      // 保存账户变更
      await queryRunner.manager.save(account);

      // 记录交易
      const transaction = new Transaction();
      transaction.accountId = account.id;
      transaction.appId = appId;
      transaction.amount = amount;
      transaction.balance = account.balance;
      transaction.balanceAfter = account.balance;
      transaction.creditUsed = account.creditUsed;
      transaction.creditUsedAfter = account.creditUsed;
      transaction.type = type;
      transaction.description = description;

      await queryRunner.manager.save(transaction);

      // 提交事务
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to add balance: ${error.message}`, error.stack);
      throw error;
    } finally {
      // 释放连接
      await queryRunner.release();
    }
  }
}
