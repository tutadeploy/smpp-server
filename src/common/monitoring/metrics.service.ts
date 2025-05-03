import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class MetricsService {
  private metrics: Map<string, number> = new Map();
  private histograms: Map<string, { sum: number; count: number }> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  incrementCounter(name: string, value = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  decrementCounter(name: string, value = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, Math.max(0, current - value));
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.getHistogramKey(name, labels);
    const current = this.histograms.get(key) || { sum: 0, count: 0 };
    this.histograms.set(key, {
      sum: current.sum + value,
      count: current.count + 1,
    });
  }

  getCounter(name: string): number {
    return this.metrics.get(name) || 0;
  }

  getHistogram(
    name: string,
    labels?: Record<string, string>,
  ): { sum: number; count: number } {
    const key = this.getHistogramKey(name, labels);
    return this.histograms.get(key) || { sum: 0, count: 0 };
  }

  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, value] of this.metrics.entries()) {
      result[name] = value;
    }
    return result;
  }

  getHistograms(): Record<string, { sum: number; count: number }> {
    const result: Record<string, { sum: number; count: number }> = {};
    for (const [name, value] of this.histograms.entries()) {
      result[name] = value;
    }
    return result;
  }

  private getHistogramKey(
    name: string,
    labels?: Record<string, string>,
  ): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}
