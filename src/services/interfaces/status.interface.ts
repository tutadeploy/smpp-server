import { StatusResponseDto } from '../../api/dto/response.dto';

export interface IStatusService {
  getMessageStatus(appId: string, msgId: string): Promise<StatusResponseDto>;
}
