import { Registry } from 'prom-client';

export declare class MetricsService {
  private readonly logger;
  private readonly registry: Registry;
  private readonly counters;
  private readonly gauges;
  private readonly histograms;

  constructor();

  incrementCounter(name: string, value?: number): void;
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value?: number,
  ): void;

  setGauge(name: string, value: number): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;

  recordHistogram(name: string, value: number): void;
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void;

  startTimer(name: string, labels?: Record<string, string>): () => void;

  getMetrics(): Promise<string>;
  resetMetrics(): Promise<void>;

  incrementSmsCounter(status: string): void;
  incrementSmppConnectionCounter(status: string): void;
  recordSmsSendDuration(duration: number): void;
  recordSmppConnectionDuration(duration: number): void;
  recordQueueSize(size: number): void;
  recordBalanceValue(appId: string, balance: number): void;
}
