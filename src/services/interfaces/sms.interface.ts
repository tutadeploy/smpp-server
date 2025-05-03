import { SendSmsDto } from '../../api/dto/send-sms.dto';
import { SmsResponseDto } from '../../api/dto/response.dto';

export interface ISmsService {
  processSendRequest(data: SendSmsDto): Promise<SmsResponseDto>;
  getMessageStatus(appId: string, messageId: string): Promise<SmsResponseDto>;
}
