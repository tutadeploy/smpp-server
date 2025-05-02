import { registerAs } from '@nestjs/config';

export default registerAs('smpp', () => ({
  connectionTimeout: parseInt(
    process.env.SMPP_CONNECTION_TIMEOUT || '30000',
    10,
  ),
  requestTimeout: parseInt(process.env.SMPP_REQUEST_TIMEOUT || '45000', 10),
  enquireLinkInterval: parseInt(
    process.env.SMPP_ENQUIRE_LINK_INTERVAL || '30000',
    10,
  ),
  reconnectInterval: parseInt(
    process.env.SMPP_RECONNECT_INTERVAL || '5000',
    10,
  ),
  maxReconnectAttempts: parseInt(
    process.env.SMPP_MAX_RECONNECT_ATTEMPTS || '-1',
    10,
  ), // -1 表示无限重试
  logPdu: process.env.SMPP_LOG_PDU === 'true',
  logLevel: process.env.SMPP_LOG_LEVEL || 'info',
}));
