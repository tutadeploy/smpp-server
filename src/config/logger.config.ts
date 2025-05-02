import { registerAs } from '@nestjs/config';

export default registerAs('logger', () => ({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  file: {
    enabled: process.env.LOG_FILE_ENABLED !== 'false',
    path: process.env.LOG_FILE_PATH || 'logs',
    maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
  },
  console: {
    enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
  },
  sensitiveFields: (
    process.env.LOG_SENSITIVE_FIELDS || 'password,apiSecret,token'
  ).split(','),
  requestBody: {
    enabled: process.env.LOG_REQUEST_BODY_ENABLED === 'true',
  },
}));
