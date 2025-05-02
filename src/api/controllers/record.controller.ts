import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SentRecordResponseDto } from '../dto/response.dto';
import { RecordService } from '../../services/record.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RecordQueryDto } from '../dto/record-query.dto';
import { RecordResponseDto } from '../dto/record-response.dto';

@ApiTags('发送记录')
@Controller('api/v1')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Get('getSentRcd')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '查询发送记录' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: SentRecordResponseDto,
  })
  async getSentRcd(
    @Query('appId') appId: string,
    @Query() query: RecordQueryDto,
  ): Promise<RecordResponseDto> {
    return this.recordService.getSmsRecords(appId, {
      page: query.page,
      pageSize: query.pageSize,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      phoneNumber: query.phoneNumber,
      status: query.status,
    });
  }
}
