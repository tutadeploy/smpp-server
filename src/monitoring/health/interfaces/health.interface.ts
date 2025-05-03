export interface HealthCheck {
  status: 'up' | 'down';
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'up' | 'down';
  [key: string]: HealthCheck | 'up' | 'down' | number;
  timestamp: number;
}

export interface HealthIndicator {
  isHealthy(): Promise<HealthCheck>;
  getName(): string;
}
