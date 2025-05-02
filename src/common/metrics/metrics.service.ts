import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MetricsService {
  private metrics: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('metrics.enabled', false);
    if (this.enabled) {
      // 初始化指标收集
      this.initializeMetrics();
    }
  }

  private initializeMetrics() {
    // 初始化默认指标
    this.metrics.set('messages_processed', 0);
    this.metrics.set('messages_failed', 0);
    this.metrics.set('messages_queued', 0);
    this.metrics.set('connections_active', 0);
    this.metrics.set('connections_total', 0);
    this.metrics.set('batch_processing_time', 0);
  }

  increment(metric: string, value: number = 1) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  // 别名，与 increment 功能相同，兼容接口
  incrementCounter(metric: string, value: number = 1) {
    this.increment(metric, value);
  }

  decrement(metric: string, value: number = 1) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, Math.max(0, current - value));
  }

  set(metric: string, value: number) {
    this.metrics.set(metric, value);
  }

  // 别名，与 set 功能相同，兼容接口
  setGauge(metric: string, value: number) {
    this.set(metric, value);
  }

  get(metric: string): number {
    return this.metrics.get(metric) || 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  reset(metric: string) {
    this.metrics.set(metric, 0);
  }

  resetAll() {
    this.initializeMetrics();
  }

  recordHistogram(metric: string, value: number) {
    if (!this.histograms.has(metric)) {
      this.histograms.set(metric, []);
    }
    this.histograms.get(metric).push(value);
  }

  getHistogram(metric: string): number[] {
    return this.histograms.get(metric) || [];
  }

  getHistogramSummary(metric: string): {
    min: number;
    max: number;
    avg: number;
    count: number;
  } {
    const values = this.getHistogram(metric);

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;

    return {
      min,
      max,
      avg,
      count: values.length,
    };
  }
}
