import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SentRecordResponseDto } from '../dto/response.dto';
import { RECORD_SERVICE } from '../../services/services.constants';
import { IRecordService } from '../../services/interfaces/record.interface';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RecordQueryDto } from '../dto/record-query.dto';
import { RecordResponseDto } from '../dto/record-response.dto';

@ApiTags('发送记录')
@Controller('api/v1')
export class RecordController {
  constructor(
    @Inject(RECORD_SERVICE)
    private readonly recordService: IRecordService,
  ) {}

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
    return this.recordService.getSmsRecords(
      appId,
      query.page,
      query.pageSize,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
      query.phoneNumber,
      query.status,
    );
  }
}
