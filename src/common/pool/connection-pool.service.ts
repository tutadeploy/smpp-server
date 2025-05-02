import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SmppProvider } from '../../provider/interfaces/provider.interface';
import { SmppClientService } from '../../provider/smpp-client.service';

@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly pool: Map<string, SmppProvider> = new Map();

  constructor(private readonly smppClientService: SmppClientService) {}

  async getConnection(providerId: string = 'default'): Promise<SmppProvider> {
    let provider = this.pool.get(providerId);

    if (!provider) {
      provider = this.smppClientService.getClient(providerId);
      this.pool.set(providerId, provider);
    }

    return provider;
  }

  async releaseConnection(providerId: string): Promise<void> {
    const provider = this.pool.get(providerId);
    if (provider) {
      await provider.disconnect();
      this.pool.delete(providerId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [providerId, provider] of this.pool.entries()) {
      try {
        await provider.disconnect();
        this.pool.delete(providerId);
      } catch (error) {
        this.logger.error(
          `关闭连接失败 [${providerId}]: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}
