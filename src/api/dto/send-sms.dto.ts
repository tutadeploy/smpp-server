import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({ description: '应用ID' })
  @IsNotEmpty()
  @IsString()
  appId: string;

  @ApiProperty({
    description: '短信接收号码，多个号码以英文逗号分隔，支持国际格式(带+号)',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[+0-9,]+$/, {
    message:
      '手机号码格式不正确，应为以逗号分隔的数字字符串，可带国际区号前缀(+)',
  })
  numbers: string;

  @ApiProperty({ description: '短信内容' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: '发送者ID，最大长度20字符', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  senderId?: string;

  @ApiProperty({ description: '自定义消息ID', required: false })
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class SmsResponseDto {
  @ApiProperty({ description: '状态码，0成功，其他失败' })
  status: string;

  @ApiProperty({ description: '失败原因描述' })
  reason: string;

  @ApiProperty({ description: '提交成功的号码数' })
  success: string;

  @ApiProperty({ description: '提交失败的号码数' })
  fail: string;

  @ApiProperty({ description: '消息结果数组' })
  array: Array<{
    msgId: string;
    number: string;
    orderId?: string;
  }>;
}
