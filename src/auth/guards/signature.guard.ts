import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Service } from '../../entities/service.entity';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: Service;
}

@Injectable()
export class SignatureGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const service = request.user;

    if (!service) {
      throw new UnauthorizedException('Service not found');
    }

    const timestamp = parseInt(
      String(request.headers['x-timestamp'] ?? '0'),
      10,
    );
    const signature = String(request.headers['x-signature'] ?? '');

    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing timestamp or signature');
    }

    return this.authService.validateSignature(service, timestamp, signature);
  }
}
