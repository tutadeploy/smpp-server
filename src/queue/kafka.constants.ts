// Kafka服务依赖注入令牌
export const KAFKA_SERVICE = Symbol('KAFKA_SERVICE');

// Kafka主题常量
export const KAFKA_TOPICS = {
  SMS_REQUESTS: 'sms.requests',
  SMS_STATUS: 'sms.status',
  SMS_DLR: 'sms.dlr',
};

// Kafka配置常量
export const KAFKA_CONFIG = {
  CLIENT_ID: 'smpp-server',
  GROUP_ID: 'smpp-consumer-group',
  BROKER_HOSTS: process.env.KAFKA_BROKERS || 'localhost:9092',
};
