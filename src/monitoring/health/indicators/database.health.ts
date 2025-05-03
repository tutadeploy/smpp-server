import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { HealthCheck, HealthIndicator } from '../interfaces/health.interface';

@Injectable()
export class DatabaseHealthIndicator implements HealthIndicator {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  getName(): string {
    return 'database';
  }

  async isHealthy(): Promise<HealthCheck> {
    try {
      // 检查数据库连接
      if (!this.connection.isConnected) {
        return {
          status: 'down',
          details: { error: 'Database connection is not established' },
        };
      }

      // 执行简单查询测试数据库响应
      await this.connection.query('SELECT 1');

      return {
        status: 'up',
        details: {
          type: this.connection.options.type,
          database: this.connection.options.database,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        details: { error: error.message },
      };
    }
  }
}
