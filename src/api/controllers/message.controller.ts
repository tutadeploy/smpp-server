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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendSmsDto, SmsResponseDto } from '../dto/send-sms.dto';
import { SmsQueueService } from '../../queue/sms-queue.service';
import { MetricsService } from '../../monitoring/metrics.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { SmsService } from '../../services/sms.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

@ApiTags('短信服务')
@Controller('api/v1')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);
  private readonly BATCH_SIZE = 100; // 每批处理的号码数量

  constructor(
    private readonly smsQueueService: SmsQueueService,
    private readonly metricsService: MetricsService,
    private readonly smsService: SmsService,
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
    this.metricsService.incrementCounter('message.send.attempt');
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
        phoneNumbers,
        content: decodeURIComponent(content),
        senderId,
        orderId,
      });
      this.metricsService.incrementCounter('message.queue.success');
      this.metricsService.recordHistogram(
        'message.queue.latency',
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      this.metricsService.incrementCounter('message.queue.error');
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
    this.metricsService.incrementCounter('message.send.attempt');
    const startTime = Date.now();

    // 验证电话号码数量限制
    const phoneNumbers = dto.numbers.split(',');
    if (phoneNumbers.length > 1000) {
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
        appId: dto.appId,
        phoneNumbers,
        content: dto.content,
        senderId: dto.senderId,
        orderId: dto.orderId,
      });
      this.metricsService.incrementCounter('message.queue.success');
      this.metricsService.recordHistogram(
        'message.queue.latency',
        Date.now() - startTime,
      );
      return result;
    } catch (error) {
      this.metricsService.incrementCounter('message.queue.error');
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
  @UseInterceptors(FileInterceptor('file'))
  async batchSendSms(
    @UploadedFile() file: any,
    @Body() body: { appId: string; content: string; senderId?: string },
  ): Promise<{
    status: string;
    reason: string;
    success: number;
    fail: number;
  }> {
    const { appId, content, senderId } = body;
    this.logger.warn(
      `[DEBUG] batchSendSms 参数: appId=${appId}, content=${content}, senderId=${senderId}`,
    );
    this.logger.warn(`[DEBUG] batchSendSms file meta: ${JSON.stringify(file)}`);
    this.metricsService.incrementCounter('message.batch.send.attempt');

    if (!appId) {
      throw new HttpException(
        {
          status: '1',
          reason: 'INVALID_APP_ID',
          success: 0,
          fail: 0,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      let fileContent = '';
      if (file.buffer) {
        fileContent = file.buffer.toString('utf8');
      } else if (file.path) {
        fileContent = fs.readFileSync(file.path, 'utf8');
      } else {
        throw new HttpException('无法读取上传文件内容', HttpStatus.BAD_REQUEST);
      }
      const phoneNumbers = fileContent.split('\n').filter((num) => num.trim());

      // 验证电话号码数量限制
      if (phoneNumbers.length > 10000) {
        throw new HttpException(
          'Too many phone numbers. Maximum allowed is 10000',
          HttpStatus.BAD_REQUEST,
        );
      }

      let successCount = 0;
      let failCount = 0;

      // 将号码分组处理
      const batches = [];
      for (let i = 0; i < phoneNumbers.length; i += this.BATCH_SIZE) {
        const batch = phoneNumbers.slice(i, i + this.BATCH_SIZE);
        batches.push(
          this.smsService
            .processSendRequest({
              appId,
              phoneNumbers: batch,
              content,
              senderId,
            })
            .then((result) => {
              if (result.status === '0') {
                successCount += batch.length;
              } else {
                failCount += batch.length;
              }
            })
            .catch((error) => {
              failCount += batch.length;
              this.logger.error(`Failed to send SMS batch: ${error.message}`);
            }),
        );
      }

      // 并发处理所有批次
      await Promise.all(batches);

      // 删除临时文件（如有）
      if (file.path) {
        fs.unlinkSync(file.path);
      }

      const response = {
        status: '0',
        reason: 'BATCH_SEND_COMPLETED',
        success: successCount,
        fail: failCount,
      };

      this.metricsService.incrementCounter('message.batch.send.success');
      return response;
    } catch (error) {
      this.metricsService.incrementCounter('message.batch.send.error');
      throw new HttpException(
        {
          status: '1',
          reason: error.message || '批量发送失败',
          success: 0,
          fail: 0,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
