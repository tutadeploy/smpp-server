import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { STATUS_SERVICE } from '../../services/services.constants';
import { IStatusService } from '../../services/interfaces/status.interface';
import { StatusResponseDto } from '../dto/response.dto';
import { SMPP_CLIENT_SERVICE } from '../../provider/provider.constants';
import { ISmppClientService } from '../../provider/interfaces/smpp-client.interface';

@ApiTags('Status')
@Controller('status')
export class StatusController {
  constructor(
    @Inject(STATUS_SERVICE)
    private readonly statusService: IStatusService,
    @Inject(SMPP_CLIENT_SERVICE)
    private readonly smppClientService: ISmppClientService,
  ) {}

  @Get('session')
  @ApiOperation({ summary: 'Get SMPP session status' })
  @ApiResponse({
    status: 200,
    description: 'Successfully returned session status',
  })
  async getSessionInfo() {
    const client = await this.smppClientService.getClient();
    if (!client) {
      throw new HttpException(
        'No active SMPP client available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      sessionId: client.getSessionId(),
      state: client.getState(),
      connected: client.isConnected(),
    };
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get all providers status' })
  @ApiResponse({
    status: 200,
    description: 'Successfully returned providers status',
  })
  async getProvidersStatus() {
    const clientsMap = await this.smppClientService.getAllClients();
    const activeProviderId = await this.smppClientService.getActiveProviderId();
    // 将Map转换为数组
    const clients = Array.from(clientsMap.values());
    return clients.map((client) => ({
      providerId: client.getProviderId(),
      status: client.getState(),
      connected: client.isConnected(),
      isActive: client.getProviderId() === activeProviderId,
    }));
  }

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get specific provider status' })
  @ApiResponse({
    status: 200,
    description: 'Successfully returned provider status',
  })
  async getProviderStatus(@Param('providerId') providerId: string) {
    const activeProviderId = await this.smppClientService.getActiveProviderId();
    const clientsMap = await this.smppClientService.getAllClients();
    // 直接从Map中获取指定的客户端
    const client = clientsMap.get(providerId);
    if (!client) {
      throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);
    }
    return {
      providerId: client.getProviderId(),
      status: client.getState(),
      connected: client.isConnected(),
      isActive: client.getProviderId() === activeProviderId,
    };
  }

  @Get('switch/:providerId')
  @ApiOperation({ summary: 'Switch active provider' })
  @ApiResponse({
    status: 200,
    description: 'Successfully switched provider',
  })
  async switchProvider(@Param('providerId') providerId: string) {
    await this.smppClientService.switchActiveProvider(providerId);
    return { message: 'Provider switched successfully' };
  }

  @Get('test')
  @ApiOperation({ summary: 'Test all provider connections' })
  @ApiResponse({
    status: 200,
    description: 'Successfully tested connections',
  })
  async testConnections() {
    const results = await this.smppClientService.testConnections();
    const activeProviderId = await this.smppClientService.getActiveProviderId();
    // 将Map转换为对象以便JSON化
    const resultsObject = Object.fromEntries(results);
    return {
      results: resultsObject,
      activeProviderId,
    };
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: 'Get message status' })
  @ApiResponse({
    status: 200,
    description: 'Successfully returned message status',
  })
  async getMessageStatus(@Param('messageId') messageId: string) {
    return this.smppClientService.getMessageStatus(messageId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get message statistics' })
  @ApiResponse({
    status: 200,
    description: 'Successfully returned message statistics',
  })
  async getMessageStats(): Promise<StatusResponseDto> {
    const stats = await this.smppClientService.getMessageStats();
    return {
      ...stats,
      status: '0',
      reason: 'Success',
      success: '1',
      fail: '0',
    };
  }
}
