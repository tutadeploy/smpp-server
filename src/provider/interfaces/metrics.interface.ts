/**
 * 指标服务接口
 * 用于收集和记录系统指标
 */
export interface IMetricsService {
  /**
   * 增加计数器
   * @param name 计数器名称
   * @param tags 标签
   */
  incrementCounter(name: string, tags?: Record<string, string>): void;

  /**
   * 记录直方图值
   * @param name 直方图名称
   * @param value 值
   * @param tags 标签
   */
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void;

  /**
   * 记录仪表盘值
   * @param name 仪表盘名称
   * @param value 值
   * @param tags 标签
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}

// 指标服务依赖注入令牌
export const METRICS_SERVICE = Symbol('METRICS_SERVICE');
