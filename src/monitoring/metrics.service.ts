import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;
  private readonly counters: Map<string, Counter>;
  private readonly gauges: Map<string, Gauge>;
  private readonly histograms: Map<string, Histogram>;

  constructor() {
    this.registry = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // 短信相关指标
    this.createCounter('sms_requests_total', 'Total number of SMS requests', [
      'status',
    ]);
    this.createCounter('sms_sent_total', 'Number of sent SMS', [
      'status',
      'provider',
    ]);
    this.createCounter('sms_delivery_status', 'SMS delivery status count', [
      'status',
    ]);
    this.createGauge('sms_daily_quota_remaining', 'Remaining daily SMS quota', [
      'app_id',
    ]);
    this.createHistogram('sms_length_bytes', 'SMS content length in bytes', {
      buckets: [50, 100, 150, 200, 250, 300],
    });

    // 队列相关指标
    this.createGauge('queue_size', 'Current queue size', ['queue_name']);
    this.createGauge('queue_lag', 'Consumer lag in messages', ['queue_name']);
    this.createCounter(
      'queue_messages_total',
      'Total messages processed by queue',
      ['queue_name', 'status'],
    );
    this.createHistogram(
      'queue_processing_duration_seconds',
      'Message processing duration',
      {
        buckets: [0.1, 0.5, 1, 2, 5, 10],
      },
    );
    this.createGauge(
      'queue_consumer_up',
      'Consumer status (1 for up, 0 for down)',
      ['queue_name'],
    );

    // SMPP连接相关指标
    this.createGauge('smpp_connections', 'Number of active SMPP connections', [
      'provider',
    ]);
    this.createCounter('smpp_connection_errors', 'SMPP connection errors', [
      'provider',
      'error_type',
    ]);
    this.createHistogram(
      'smpp_request_duration_seconds',
      'SMPP request duration',
      {
        buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
      },
    );
    this.createCounter('smpp_bind_attempts', 'SMPP bind attempts', [
      'provider',
      'status',
    ]);

    // 系统资源指标
    this.createGauge('process_memory_bytes', 'Process memory usage in bytes', [
      'type',
    ]);
    this.createGauge('process_cpu_usage', 'Process CPU usage percentage');
    this.createGauge('nodejs_eventloop_lag_seconds', 'Node.js event loop lag');
    this.createGauge('nodejs_active_handles', 'Number of active handles');
    this.createGauge('nodejs_active_requests', 'Number of active requests');

    // 业务指标
    this.createGauge('account_balance', 'Account balance', ['app_id']);
    this.createCounter('account_transactions', 'Account transactions', [
      'app_id',
      'type',
    ]);
    this.createHistogram('message_cost', 'Message cost in currency', {
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // API性能指标
    this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration',
      {
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
        labelNames: ['method', 'route', 'status_code'],
      },
    );
    this.createCounter('http_requests_total', 'Total HTTP requests', [
      'method',
      'route',
      'status_code',
    ]);
    this.createGauge('http_requests_in_progress', 'In-progress HTTP requests', [
      'method',
      'route',
    ]);
  }

  /**
   * 创建计数器
   */
  private createCounter(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): void {
    try {
      const counter = new Counter({
        name,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.counters.set(name, counter);
    } catch (error) {
      this.logger.error(`创建计数器失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 创建仪表盘
   */
  private createGauge(
    name: string,
    help: string,
    labelNames: string[] = [],
  ): void {
    try {
      const gauge = new Gauge({
        name,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.gauges.set(name, gauge);
    } catch (error) {
      this.logger.error(`创建仪表盘失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 创建直方图
   */
  private createHistogram(
    name: string,
    help: string,
    config: { buckets: number[]; labelNames?: string[] },
  ): void {
    try {
      const histogram = new Histogram({
        name,
        help,
        buckets: config.buckets,
        labelNames: config.labelNames || [],
        registers: [this.registry],
      });
      this.histograms.set(name, histogram);
    } catch (error) {
      this.logger.error(`创建直方图失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 增加计数器值
   */
  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1,
  ): void {
    try {
      const counter = this.counters.get(name);
      if (counter) {
        counter.inc(labels, value);
      }
    } catch (error) {
      this.logger.error(`增加计数器失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 设置仪表盘值
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    try {
      const gauge = this.gauges.get(name);
      if (gauge) {
        gauge.set(labels, value);
      }
    } catch (error) {
      this.logger.error(`设置仪表盘失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 记录直方图值
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    try {
      const histogram = this.histograms.get(name);
      if (histogram) {
        histogram.observe(labels, value);
      }
    } catch (error) {
      this.logger.error(`记录直方图失败 [${name}]: ${error.message}`);
    }
  }

  /**
   * 开始计时
   */
  startTimer(name: string, labels: Record<string, string> = {}): () => void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      const end = histogram.startTimer(labels);
      return end;
    }
    return () => {};
  }

  /**
   * 更新系统资源指标
   */
  updateSystemMetrics(): void {
    try {
      // 内存使用情况
      const memoryUsage = process.memoryUsage();
      this.setGauge('process_memory_bytes', memoryUsage.heapUsed, {
        type: 'heap_used',
      });
      this.setGauge('process_memory_bytes', memoryUsage.heapTotal, {
        type: 'heap_total',
      });
      this.setGauge('process_memory_bytes', memoryUsage.rss, { type: 'rss' });

      // CPU使用情况
      const cpuUsage = process.cpuUsage();
      this.setGauge(
        'process_cpu_usage',
        (cpuUsage.user + cpuUsage.system) / 1000000,
      );

      // Event Loop延迟
      const startTime = process.hrtime();
      setImmediate(() => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        this.setGauge(
          'nodejs_eventloop_lag_seconds',
          seconds + nanoseconds / 1e9,
        );
      });

      // 活动资源
      const resourcesInfo = process.getActiveResourcesInfo?.() || [];
      this.setGauge('nodejs_active_resources', resourcesInfo.length);

      // 按类型统计资源
      interface ResourceInfo {
        type: string;
        [key: string]: any;
      }

      const resourceTypes = (resourcesInfo as unknown as ResourceInfo[]).reduce(
        (acc, resource) => {
          acc[resource.type] = (acc[resource.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(resourceTypes).forEach(([type, count]) => {
        this.setGauge('nodejs_resources_by_type', count, { type });
      });
    } catch (error) {
      this.logger.error(`更新系统指标失败: ${error.message}`);
    }
  }

  /**
   * 获取所有指标
   */
  async getMetrics(): Promise<string> {
    try {
      // 更新系统指标
      this.updateSystemMetrics();
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error(`获取指标失败: ${error.message}`);
      return '';
    }
  }

  /**
   * 重置所有指标
   */
  async resetMetrics(): Promise<void> {
    try {
      await this.registry.resetMetrics();
    } catch (error) {
      this.logger.error(`重置指标失败: ${error.message}`);
    }
  }
}
