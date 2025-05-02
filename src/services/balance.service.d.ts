export declare class BalanceService {
  checkBalance(appId: string, messageCount: number): Promise<boolean>;
  deductBalance(
    appId: string,
    amount: number,
    description: string,
  ): Promise<void>;
  getBalance(appId: string): Promise<number>;
  getBalanceDto(appId: string): Promise<{
    status: string;
    reason: string;
    balance: string;
    gift: string;
    credit: string;
  }>;
  rechargeBalance(
    appId: string,
    amount: number,
    description: string,
  ): Promise<boolean>;
}
