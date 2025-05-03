import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendSmsDto, SmsResponseDto } from '../dto/send-sms.dto';
import { MetricsService } from '../../monitoring/metrics.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { SMS_SERVICE } from '../../services/services.constants';
import { ISmsService } from '../../services/interfaces/sms.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';
import { QUEUE_SERVICE } from '../../queue/constants';
import { IQueueService } from '../../queue/interfaces/queue.interface';

@ApiTags('短信服务')
@Controller('api/v1')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);
  private readonly BATCH_SIZE = 100; // 每批处理的号码数量

  constructor(
    @Inject(QUEUE_SERVICE)
    private readonly queueService: IQueueService,
    private readonly metricsService: MetricsService,
    @Inject(SMS_SERVICE)
    private readonly smsService: ISmsService,
  ) {}

  @Get('sendSms')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '发送短信(GET)' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: SmsResponseDto,
  })
  async sendSmsByGet(
    @Query('appId') appId: string,
    @Query('numbers') numbers: string,
    @Query('content') content: string,
    @Query('senderId') senderId?: string,
    @Query('orderId') orderId?: string,
  ): Promise<SmsResponseDto> {
    this.metricsService.incrementCounter('message_send_attempt');
    const startTime = Date.now();

    // 验证电话号码数量限制
    const phoneNumbers = numbers.split(',');
    if (phoneNumbers.length > 100) {
      throw new HttpException(
        {
          status: '1',
          reason: '号码数量超过限制',
          success: '0',
          fail: String(phoneNumbers.length),
          array: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.smsService.processSendRequest({
        appId,
        numbers,
        content: decodeURIComponent(content),
        senderId,
        orderId,
      });
      this.metricsService.incrementCounter('message_queue_success');
      this.metricsService.recordHistogram(
        'message_queue_latency',
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      this.metricsService.incrementCounter('message_queue_error');
      return {
        status: '1',
        reason: error.message || 'Failed to queue message',
        success: '0',
        fail: phoneNumbers.length.toString(),
        array: [],
      };
    }
  }

  @Post('sendSms')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '发送短信(POST)' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: SmsResponseDto,
  })
  async sendSmsByPost(@Body() dto: SendSmsDto): Promise<SmsResponseDto> {
    this.metricsService.incrementCounter('message_send_attempt');
    const startTime = Date.now();

    // 验证电话号码数量限制
    const phoneNumbers = dto.numbers.split(',');
    if (phoneNumbers.length > 100) {
      throw new HttpException(
        {
          status: '1',
          reason: '号码数量超过限制',
          success: '0',
          fail: String(phoneNumbers.length),
          array: [],
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.smsService.processSendRequest(dto);
      this.metricsService.incrementCounter('message_queue_success');
      this.metricsService.recordHistogram(
        'message_queue_latency',
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      this.metricsService.incrementCounter('message_queue_error');
      return {
        status: '1',
        reason: error.message || 'Failed to queue message',
        success: '0',
        fail: phoneNumbers.length.toString(),
        array: [],
      };
    }
  }

  @Post('batchSendSms')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '批量发送短信' })
  @ApiResponse({
    status: 200,
    description: '成功',
    type: SmsResponseDto,
  })
  async batchSendSms(
    @UploadedFile() file: any,
    @Body() body: { appId: string; content: string; senderId?: string },
  ): Promise<{
    status: string;
    reason: string;
    success: number;
    fail: number;
  }> {
    this.metricsService.incrementCounter('message_batch_send_attempt');
    const startTime = Date.now();

    if (!file) {
      throw new HttpException(
        {
          status: '1',
          reason: '请上传文件',
          success: 0,
          fail: 0,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const filePath = file.path;
    let successCount = 0;
    let failCount = 0;

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const phoneNumbers = fileContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (phoneNumbers.length === 0) {
        throw new HttpException(
          {
            status: '1',
            reason: '文件内容为空',
            success: 0,
            fail: 0,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 分批处理
      for (let i = 0; i < phoneNumbers.length; i += this.BATCH_SIZE) {
        const batch = phoneNumbers.slice(i, i + this.BATCH_SIZE);
        const numbers = batch.join(',');

        try {
          const result = await this.smsService.processSendRequest({
            appId: body.appId,
            numbers,
            content: body.content,
            senderId: body.senderId,
          });

          if (result.status === '0') {
            successCount += parseInt(result.success);
            failCount += parseInt(result.fail);
          } else {
            failCount += batch.length;
          }
        } catch (error) {
          this.logger.error(`批量发送失败: ${error.message}`, error.stack);
          failCount += batch.length;
        }
      }

      this.metricsService.incrementCounter('message_batch_send_success');
      this.metricsService.recordHistogram(
        'message_batch_send_latency',
        Date.now() - startTime,
      );

      return {
        status: '0',
        reason: '批量发送完成',
        success: successCount,
        fail: failCount,
      };
    } catch (error) {
      this.metricsService.incrementCounter('message_batch_send_error');
      throw new HttpException(
        {
          status: '1',
          reason: error.message || '批量发送失败',
          success: successCount,
          fail: failCount,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // 清理临时文件
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}
