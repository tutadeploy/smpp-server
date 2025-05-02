import { ApiProperty } from '@nestjs/swagger';

export class SmsRecordItemDto {
  @ApiProperty({ description: '消息ID' })
  messageId: string;

  @ApiProperty({ description: '手机号码' })
  phoneNumber: string;

  @ApiProperty({ description: '内容' })
  content: string;

  @ApiProperty({
    description: '状态',
    enum: ['PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'ERROR'],
  })
  status: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: string;

  @ApiProperty({ description: '更新时间', required: false })
  updatedAt?: string;

  @ApiProperty({ description: '发送时间', required: false })
  sentAt?: string;
}

export class RecordResponseDto {
  @ApiProperty({ description: '状态码', example: '0' })
  status: string;

  @ApiProperty({ description: '状态说明', example: '成功' })
  reason: string;

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页条数' })
  pageSize: number;

  @ApiProperty({ description: '记录列表', type: [SmsRecordItemDto] })
  records: SmsRecordItemDto[];
}
