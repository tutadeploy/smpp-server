import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';

interface DatabaseError extends Error {
  message: string;
}

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 检查数据库连接状态
      const connectionStatus = await this.checkConnection();

      // 检查数据库性能指标
      const performanceMetrics = await this.checkPerformance();

      // 检查数据库空间使用情况
      const storageStatus = await this.checkStorage();

      const result = this.getStatus(key, connectionStatus.isConnected, {
        connection: connectionStatus,
        performance: performanceMetrics,
        storage: storageStatus,
      });

      return result;
    } catch (error) {
      const dbError = error as DatabaseError;
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          message: dbError.message,
        }),
      );
    }
  }

  private async checkConnection(): Promise<{
    isConnected: boolean;
    details: Record<string, unknown>;
  }> {
    try {
      // 检查数据库连接
      await this.dataSource.query('SELECT 1');

      return {
        isConnected: true,
        details: {
          type: this.dataSource.options.type,
          database: this.dataSource.options.database,
          lastCheckedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const dbError = error as DatabaseError;
      return {
        isConnected: false,
        details: {
          error: dbError.message,
        },
      };
    }
  }

  private async checkPerformance(): Promise<{
    status: boolean;
    details: Record<string, unknown>;
  }> {
    try {
      // 检查数据库性能指标
      const activeConnections = await this.getActiveConnections();
      const queryResponseTime = await this.getQueryResponseTime();

      return {
        status: true,
        details: {
          activeConnections,
          queryResponseTime,
          lastCheckedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const dbError = error as DatabaseError;
      return {
        status: false,
        details: {
          error: dbError.message,
        },
      };
    }
  }

  private async checkStorage(): Promise<{
    status: boolean;
    details: Record<string, unknown>;
  }> {
    try {
      // 检查数据库存储状态
      const dbSize = await this.getDatabaseSize();
      const tableStats = await this.getTableStats();

      return {
        status: true,
        details: {
          databaseSize: dbSize,
          tableStats,
          lastCheckedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const dbError = error as DatabaseError;
      return {
        status: false,
        details: {
          error: dbError.message,
        },
      };
    }
  }

  private async getActiveConnections(): Promise<number> {
    try {
      const result = await this.dataSource.query(
        'SELECT count(*) as count FROM pg_stat_activity WHERE state = $1',
        ['active'],
      );
      return parseInt(result[0].count, 10);
    } catch (error) {
      return -1;
    }
  }

  private async getQueryResponseTime(): Promise<number> {
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      return Date.now() - startTime;
    } catch (error) {
      return -1;
    }
  }

  private async getDatabaseSize(): Promise<string> {
    try {
      const dbName = this.dataSource.options.database;
      if (typeof dbName !== 'string') {
        throw new Error('Database name must be a string');
      }
      const result = await this.dataSource.query(
        'SELECT pg_size_pretty(pg_database_size($1)) as size',
        [dbName],
      );
      return result[0].size as string;
    } catch (error) {
      return 'unknown';
    }
  }

  private async getTableStats(): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.dataSource.query<
        Array<Record<string, unknown>>
      >(`
        SELECT
          schemaname::text as schemaname,
          relname::text as table_name,
          n_live_tup::bigint as row_count,
          pg_size_pretty(pg_total_relation_size('"' || schemaname || '"."' || relname || '"'))::text as total_size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `);
      return result;
    } catch (error) {
      return [];
    }
  }
}
