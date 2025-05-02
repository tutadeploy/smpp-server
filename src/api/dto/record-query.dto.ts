import { IsOptional, IsString, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RecordQueryDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @ApiProperty({ description: '每页记录数', required: false, default: 10 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  pageSize: number = 10;

  @ApiProperty({ description: '开始日期', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    description: '状态',
    required: false,
    enum: ['PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'ERROR'],
  })
  @IsString()
  @IsOptional()
  status?: string;
}
