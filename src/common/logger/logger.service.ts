import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../config/configuration';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    const config = this.configService.get<Configuration['log']>('log');
    this.logger = winston.createLogger({
      level: config.level,
      format: this.getFormat(config.format),
      transports: this.getTransports(config),
      defaultMeta: {
        service: this.configService.get('app.name', 'smpp-service'),
      },
    });
  }

  private getFormat(format: string): winston.Logform.Format {
    if (format === 'json') {
      return winston.format.combine(winston.format.json());
    }

    return winston.format.combine(
      winston.format.printf(
        ({ level, message }: { level: string; message: string }) => {
          if (level === 'error') {
            return `错误: ${message}`;
          }
          if (
            typeof message === 'string' &&
            (message.includes('初始化成功') || message.includes('已启动'))
          ) {
            return message;
          }
          return '';
        },
      ),
    );
  }

  private maskSensitiveData(): winston.Logform.Format {
    return winston.format((info) => {
      const sensitiveFields = this.configService.get<string[]>(
        'log.sensitiveFields',
        [],
      );
      const maskedInfo = { ...info };

      sensitiveFields.forEach((field) => {
        if (typeof maskedInfo === 'object' && maskedInfo !== null) {
          this.maskField(maskedInfo, field);
        }
      });

      return maskedInfo;
    })();
  }

  private maskField(obj: any, field: string): void {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.maskField(obj[key], field);
      } else if (key === field && typeof obj[key] === 'string') {
        obj[key] = '******';
      }
    }
  }

  private getTransports(config: Configuration['log']): winston.transport[] {
    const transports: winston.transport[] = [];

    if (config.console.enabled) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }

    if (config.file.enabled) {
      // 主日志文件
      transports.push(
        new winston.transports.File({
          filename: config.file.path,
          maxsize: this.parseSize(config.file.maxSize),
          maxFiles: this.parseTime(config.file.maxFiles),
        }),
      );

      // 错误日志文件
      transports.push(
        new winston.transports.File({
          filename: `${config.file.path.replace('.log', '')}-error.log`,
          level: 'error',
          maxsize: this.parseSize(config.file.maxSize),
          maxFiles: this.parseTime(config.file.maxFiles),
        }),
      );
    }

    return transports;
  }

  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = size.match(/^(\d+)([bkmg]b?)$/i);
    if (!match) {
      return 20 * 1024 * 1024; // 默认20MB
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit.toLowerCase()];
  }

  private parseTime(time: string): number {
    const units: Record<string, number> = {
      d: 1,
      w: 7,
      m: 30,
      y: 365,
    };

    const match = time.match(/^(\d+)([dwmy])$/i);
    if (!match) {
      return 14; // 默认14天
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit.toLowerCase()];
  }

  log(message: any, ...optionalParams: any[]) {
    this.writeLog('info', message, optionalParams[0], optionalParams[1]);
  }

  error(message: any, ...optionalParams: any[]) {
    this.writeLog('error', message, optionalParams[0], optionalParams[1]);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.writeLog('warn', message, optionalParams[0], optionalParams[1]);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.writeLog('debug', message, optionalParams[0], optionalParams[1]);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.writeLog('verbose', message, optionalParams[0], optionalParams[1]);
  }

  private writeLog(
    level: string,
    message: any,
    context?: string,
    meta?: Record<string, any>,
  ) {
    this.logger.log({
      level,
      message,
      context,
      ...(meta || {}),
    });
  }
}
