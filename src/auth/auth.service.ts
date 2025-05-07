import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../entities/service.entity';
import { createHash } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  async validateApiKey(apiKey: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { apiKey, status: 1 },
    });

    if (!service) {
      throw new UnauthorizedException('Invalid API key');
    }

    return service;
  }

  async validateSignature(
    service: Service,
    timestamp: number,
    signature: string,
  ): Promise<boolean> {
    // 检查时间戳是否在允许的范围内
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);

    if (timeDiff > service.signTolerance) {
      throw new UnauthorizedException('Signature expired');
    }

    // 按照设计文档的签名规则：API key + API secret + Timestamp
    const stringToSign = `${service.apiKey}${service.apiSecret}${timestamp}`;

    // 生成MD5签名
    const calculatedSignature = createHash('md5')
      .update(stringToSign)
      .digest('hex')
      .toLowerCase();

    if (calculatedSignature !== signature.toLowerCase()) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }

  // 添加从请求中获取API Key的辅助方法
  getApiKeyFromRequest(request: any): string {
    // 支持两种风格的API Key请求头
    // 1. 我们自己的X-API-KEY格式
    // 2. Buka的Api-Key格式
    return String(
      request.headers['x-api-key'] ||
        request.headers['api-key'] ||
        request.headers['Api-Key'] ||
        '',
    );
  }
}
