import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ProviderService } from '../../../provider/provider.service';

@Injectable()
export class SmppHealthIndicator extends HealthIndicator {
  constructor(private readonly providerService: ProviderService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isConnected = await this.providerService.testConnection();

      const result = this.getStatus(key, isConnected);

      if (isConnected) {
        return result;
      }

      throw new HealthCheckError('SMPP health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, { message: error.message });
      throw new HealthCheckError('SMPP health check failed', result);
    }
  }
}
