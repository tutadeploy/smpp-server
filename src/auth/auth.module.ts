import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../entities/service.entity';
import { Account } from '../entities/account.entity';
import { AuthService } from './auth.service';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { SignatureGuard } from './guards/signature.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Account])],
  providers: [AuthService, ApiKeyStrategy, SignatureGuard],
  exports: [AuthService],
})
export class AuthModule {}
