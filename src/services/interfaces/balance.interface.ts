import { BalanceResponseDto } from '../../api/dto/response.dto';

export interface IBalanceService {
  checkBalance(appId: string, messageCount: number): Promise<boolean>;
  deductBalance(appId: string, amount: number): Promise<void>;
  getBalance(appId: string): Promise<number>;
  getBalanceDto(appId: string): Promise<BalanceResponseDto>;
  rechargeBalance(
    appId: string,
    amount: number,
    description: string,
  ): Promise<boolean>;
}
