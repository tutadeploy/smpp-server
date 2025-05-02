import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { MetricsService } from '../common/metrics/metrics.service';

interface PoolConfig {
  minSize: number;
  maxSize: number;
  idleTimeout: number;
  acquireTimeout: number;
  testOnBorrow: boolean;
}

interface Connection {
  id: string;
  createdAt: Date;
  lastUsed: Date;
  status: 'idle' | 'active';
}

@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private connections: Connection[] = [];
  private poolConfig: PoolConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {
    // 设置默认连接池配置
    this.poolConfig = {
      minSize: 2,
      maxSize: 10,
      idleTimeout: 30000,
      acquireTimeout: 10000,
      testOnBorrow: true,
    };

    this.initialize();
  }

  private async initialize() {
    try {
      // 创建初始连接
      for (let i = 0; i < this.poolConfig.minSize; i++) {
        await this.createConnection();
      }
      this.logger.log(
        `Connection pool initialized with ${this.connections.length} connections`,
        'ConnectionPool',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize connection pool',
        'ConnectionPool',
        error instanceof Error
          ? { error: error.message }
          : { error: String(error) },
      );
    }
  }

  private async createConnection(): Promise<Connection> {
    try {
      const connection: Connection = {
        id: Math.random().toString(36).substring(7),
        createdAt: new Date(),
        lastUsed: new Date(),
        status: 'idle',
      };
      this.connections.push(connection);
      this.metrics.setGauge('connection_pool_size', this.connections.length);
      return connection;
    } catch (error) {
      this.logger.error(
        'Failed to create connection',
        'ConnectionPool',
        error instanceof Error
          ? { error: error.message }
          : { error: String(error) },
      );
      throw error;
    }
  }

  async acquire(): Promise<Connection> {
    try {
      let connection = this.connections.find((conn) => conn.status === 'idle');

      if (!connection && this.connections.length < this.poolConfig.maxSize) {
        connection = await this.createConnection();
      }

      if (!connection) {
        throw new Error('No available connections');
      }

      connection.status = 'active';
      connection.lastUsed = new Date();

      this.metrics.setGauge(
        'connection_pool_active',
        this.connections.filter((conn) => conn.status === 'active').length,
      );

      return connection;
    } catch (error) {
      this.logger.error(
        'Failed to acquire connection',
        'ConnectionPool',
        error instanceof Error
          ? { error: error.message }
          : { error: String(error) },
      );
      throw error;
    }
  }

  async release(connection: Connection): Promise<void> {
    try {
      const conn = this.connections.find((c) => c.id === connection.id);
      if (conn) {
        conn.status = 'idle';
        conn.lastUsed = new Date();
      }
      this.metrics.setGauge(
        'connection_pool_active',
        this.connections.filter((conn) => conn.status === 'active').length,
      );
    } catch (error) {
      this.logger.error(
        'Failed to release connection',
        'ConnectionPool',
        error instanceof Error
          ? { error: error.message }
          : { error: String(error) },
      );
      throw error;
    }
  }

  private async removeConnection(connection: Connection): Promise<void> {
    try {
      this.connections = this.connections.filter((c) => c.id !== connection.id);
      this.metrics.setGauge('connection_pool_size', this.connections.length);
    } catch (error) {
      this.logger.error(
        'Failed to remove connection',
        'ConnectionPool',
        error instanceof Error
          ? { error: error.message }
          : { error: String(error) },
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    // 关闭所有连接
    for (const connection of this.connections) {
      await this.removeConnection(connection);
    }
    this.logger.log('Connection pool destroyed', 'ConnectionPool');
  }
}
