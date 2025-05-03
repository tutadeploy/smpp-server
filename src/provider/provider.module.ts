import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Provider } from '../entities/provider.entity';
import { ProviderService } from './provider.service';
import { SmppClientService } from './smpp-client.service';
import { DefaultSmppClient } from './implementations/default-smpp-client';
import { StatusReport } from '../entities/status-report.entity';
import { Message } from '../entities/message.entity';
import { SMPP_CLIENT_SERVICE } from './provider.constants';
import { METRICS_SERVICE } from './interfaces/metrics.interface';

// 创建一个空的指标服务实现
class NullMetricsService {
  /**
   * 空方法实现，用于解决循环依赖
   * 在实际运行时，MonitoringModule会提供真正的MetricsService实现
   */
  incrementCounter(): void {
    // 空实现，用于占位
  }

  /**
   * 空方法实现，用于解决循环依赖
   * 在实际运行时，MonitoringModule会提供真正的MetricsService实现
   */
  recordHistogram(): void {
    // 空实现，用于占位
  }

  /**
   * 空方法实现，用于解决循环依赖
   * 在实际运行时，MonitoringModule会提供真正的MetricsService实现
   */
  recordGauge(): void {
    // 空实现，用于占位
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, StatusReport, Message]),
    ConfigModule,
  ],
  providers: [
    {
      provide: SMPP_CLIENT_SERVICE,
      useClass: SmppClientService,
    },
    // 提供一个空的指标服务实现，以解决循环依赖
    {
      provide: METRICS_SERVICE,
      useClass: NullMetricsService,
    },
    ProviderService,
    DefaultSmppClient,
  ],
  exports: [SMPP_CLIENT_SERVICE, ProviderService],
})
export class ProviderModule {}
