import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as iconv from 'iconv-lite';

@Injectable()
export class Utf8QueryMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    for (const key in req.query) {
      const value = req.query[key];
      if (typeof value === 'string') {
        // 如果是全latin1字符，尝试转码为utf8
        if (/^[\x00-\xFF]+$/.test(value)) {
          try {
            req.query[key] = iconv.decode(Buffer.from(value, 'latin1'), 'utf8');
          } catch {
            // 转码失败则保持原样
          }
        }
      }
    }
    next();
  }
}
