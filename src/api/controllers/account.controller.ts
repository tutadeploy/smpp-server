import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Inject,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BalanceResponseDto } from '../dto/response.dto';
import { BALANCE_SERVICE } from '../../services/services.constants';
import { IBalanceService } from '../../services/interfaces/balance.interface';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('账户服务')
@Controller('api/v1')
export class AccountController {
  constructor(
    @Inject(BALANCE_SERVICE)
    private readonly balanceService: IBalanceService,
  ) {}

  @Get('getBalance')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '查询账户余额' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: BalanceResponseDto,
  })
  async getBalance(@Query('appId') appId: string): Promise<BalanceResponseDto> {
    return this.balanceService.getBalanceDto(appId);
  }

  @Post('recharge')
  @ApiOperation({ summary: '账户充值' })
  @ApiResponse({ status: 200, description: '充值结果' })
  async recharge(
    @Body('appId') appId: string,
    @Body('amount') amount: number,
  ): Promise<{ status: string; reason: string }> {
    if (!appId || !amount || amount <= 0) {
      return { status: '1', reason: '参数错误' };
    }
    const ok = await this.balanceService.rechargeBalance(
      appId,
      amount,
      '手动充值',
    );
    if (ok) {
      return { status: '0', reason: '充值成功' };
    } else {
      return { status: '1', reason: '充值失败' };
    }
  }
}
