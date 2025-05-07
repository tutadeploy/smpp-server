import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { Service } from '../../entities/service.entity';

interface AuthenticatedRequest extends Request {
  user: Service;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 支持两种风格的API Key请求头
    // 1. 我们自己的X-API-KEY格式
    // 2. Buka的Api-Key格式
    const apiKey = String(
      request.headers['x-api-key'] ||
        request.headers['api-key'] ||
        request.headers['Api-Key'] ||
        '',
    );

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    // 验证API key并获取服务信息
    const service = await this.authService.validateApiKey(apiKey);

    // 将服务信息附加到请求对象
    request.user = service;

    return true;
  }
}
