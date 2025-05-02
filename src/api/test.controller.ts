import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SignatureGuard } from '../auth/guards/signature.guard';

@Controller('api/v1/test')
export class TestController {
  @Get('auth')
  @UseGuards(AuthGuard('api-key'))
  testAuth(@Request() req) {
    return {
      message: 'Authentication successful',
      service: req.user,
    };
  }

  @Get('signature')
  @UseGuards(AuthGuard('api-key'), SignatureGuard)
  testSignature(@Request() req) {
    return {
      message: 'Signature verification successful',
      service: req.user,
    };
  }
}
