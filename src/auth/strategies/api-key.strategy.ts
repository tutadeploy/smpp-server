import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities/account.entity';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
  ) {
    super({ header: 'X-API-KEY', prefix: '' }, false);
  }

  async validate(
    apiKey: string,
    done: (error: Error | null, user?: any, options?: any) => void,
  ): Promise<void> {
    try {
      const account = await this.accountRepository.findOne({
        where: { apiKey: apiKey },
      });

      if (!account || !account.active) {
        return done(new UnauthorizedException('Invalid API Key'));
      }

      return done(null, account);
    } catch (error) {
      return done(error as Error);
    }
  }
}
