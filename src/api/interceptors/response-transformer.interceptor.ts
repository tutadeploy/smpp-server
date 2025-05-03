import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LoggerService } from '../../common/logger/logger.service';
import { Response } from 'express';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseTransformerInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly logger: LoggerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode;
        const path = request.url as string;

        return {
          code: statusCode,
          message: this.getStatusMessage(statusCode),
          data,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
      catchError((error) => {
        // 提取请求信息
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const requestId =
          request.headers['x-request-id'] ||
          request.headers['request-id'] ||
          request['requestId'] ||
          `req_${Date.now()}`;

        // 转换成标准错误响应
        if (error instanceof HttpException) {
          const status = error.getStatus();
          const response = error.getResponse();

          // 如果已经是结构化错误响应，直接返回
          if (typeof response === 'object' && 'status' in response) {
            return throwError(() => error);
          }

          // 记录错误日志
          const errorContext = {
            requestId,
            method: request.method,
            path: request.url,
            query: request.query,
            body: this.sanitizeBody(request.body),
          };

          this.logger.error(
            `请求处理失败: ${error.message}, context: ${JSON.stringify(
              errorContext,
            )}`,
            error.stack,
          );

          // 构造标准错误响应
          return throwError(
            () =>
              new HttpException(
                {
                  status: '1',
                  reason:
                    typeof response === 'string'
                      ? response
                      : response['message'] || 'Unknown error',
                  success: '0',
                  fail: '0',
                  array: [],
                },
                status,
              ),
          );
        }

        // 记录未知错误
        const errorContext = {
          requestId,
          method: request.method,
          path: request.url,
        };

        this.logger.error(
          `系统错误: ${error.message}, context: ${JSON.stringify(
            errorContext,
          )}`,
          error.stack,
        );

        // 其他类型的错误
        return throwError(
          () =>
            new HttpException(
              {
                status: '1',
                reason: error.message || 'Internal server error',
                success: '0',
                fail: '0',
                array: [],
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
        );
      }),
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'apiSecret', 'token'];
    const sanitized = { ...(body as Record<string, unknown>) };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '******';
      }
    }

    return sanitized;
  }

  private getStatusMessage(statusCode: number): string {
    const statusMessages: Record<number, string> = {
      200: '请求成功',
      201: '创建成功',
      400: '请求参数错误',
      401: '未授权',
      403: '禁止访问',
      404: '未找到',
      500: '服务器内部错误',
    };

    return statusMessages[statusCode] || '未知状态';
  }
}
