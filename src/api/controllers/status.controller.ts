import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatusResponseDto } from '../dto/response.dto';
import { StatusService } from '../../services/status.service';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('短信状态')
@Controller('api/v1')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get('getReport')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '查询短信状态' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: StatusResponseDto,
  })
  async getMessageStatus(
    @Query('appId') appId: string,
    @Query('msgId') msgId: string,
  ): Promise<StatusResponseDto> {
    return this.statusService.getMessageStatus(appId, msgId);
  }
}
