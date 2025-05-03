import { ApiProperty } from '@nestjs/swagger';

export class SmsResponseDto {
  @ApiProperty({ description: '状态码，0成功，其他失败' })
  status: string;

  @ApiProperty({ description: '失败原因描述' })
  reason: string;

  @ApiProperty({ description: '提交成功的号码数' })
  success: string;

  @ApiProperty({ description: '提交失败的号码数' })
  fail: string;

  @ApiProperty({ description: '消息详情数组' })
  array: Array<{
    msgId: string;
    number: string;
    orderId?: string;
  }>;
}

export class StatusResponseDto {
  @ApiProperty({ description: '状态码，0成功，其他失败' })
  status: string;

  @ApiProperty({ description: '原因描述' })
  reason?: string;

  @ApiProperty({ description: '成功数量' })
  success?: string;

  @ApiProperty({ description: '失败数量' })
  fail?: string;

  @ApiProperty({ description: '发送中数量' })
  sending?: string;

  @ApiProperty({ description: '未发送数量' })
  notsend?: string;

  @ApiProperty({ description: '状态详情数组' })
  array?: StatusDetailItem[];
}

export class PriceDetail {
  @ApiProperty({ description: '计费条数' })
  count: number;

  @ApiProperty({ description: '单价（分）' })
  price: number;

  @ApiProperty({ description: '总价（分）' })
  total: number;
}

export class StatusDetailItem {
  @ApiProperty({ description: '消息平台msgid' })
  msgId: string;

  @ApiProperty({ description: '接收号码' })
  number: string;

  @ApiProperty({ description: '接收时间' })
  receiveTime: string;

  @ApiProperty({ description: '短信状态，0表示成功，1表示失败' })
  status: string;

  @ApiProperty({ description: '计费详情' })
  pricedetail: PriceDetail;
}

export class BalanceResponseDto {
  @ApiProperty({ description: '状态码，0成功，其他失败' })
  status: string;

  @ApiProperty({ description: '失败原因说明' })
  reason: string;

  @ApiProperty({ description: '实际账户余额' })
  balance: string;

  @ApiProperty({ description: '赠送账户余额' })
  gift: string;

  @ApiProperty({ description: '信用额度' })
  credit: string;
}

export class SentRecordResponseDto {
  @ApiProperty({ description: '状态码，0成功，其他失败' })
  status: string;

  @ApiProperty({ description: '失败原因描述' })
  reason: string;

  @ApiProperty({ description: '发送成功的条数' })
  success: string;

  @ApiProperty({ description: '发送失败的条数' })
  fail: string;

  @ApiProperty({ description: '发送记录数组' })
  array: Array<{
    msgId: string;
    number: string;
    receiveTime: string;
    status: string;
  }>;
}
