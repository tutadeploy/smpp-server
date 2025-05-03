import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SmppClientService } from '../../provider/smpp-client.service';
import { SmppProvider } from '../../provider/interfaces/provider.interface';

@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private providers: Map<string, SmppProvider> = new Map();

  constructor(private readonly smppClientService: SmppClientService) {}

  async getProvider(providerId = 'default'): Promise<SmppProvider | undefined> {
    try {
      let provider = this.providers.get(providerId);
      if (!provider) {
        provider = await this.smppClientService.getClient(providerId);
        if (provider) {
          this.providers.set(providerId, provider);
        }
      }
      return provider;
    } catch (error) {
      this.logger.error(
        `Failed to get provider ${providerId}: ${error.message}`,
      );
      return undefined;
    }
  }

  async releaseConnection(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (provider) {
      await provider.disconnect();
      this.providers.delete(providerId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [providerId, provider] of this.providers.entries()) {
      try {
        await provider.disconnect();
        this.providers.delete(providerId);
      } catch (error) {
        this.logger.error(
          `关闭连接失败 [${providerId}]: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}
