export interface SmppConfig {
  host: string;
  port: number;
  systemId: string;
  password: string;
  connectionTimeout: number;
  requestTimeout: number;
  enquireLinkInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  logPdu: boolean;
  logLevel: string;
}

export interface ProviderConfig {
  enabled: boolean;
  host: string;
  port: number;
  systemId: string;
  password: string;
  systemType: string;
  ton: number;
  npi: number;
  addrTon: number;
  addrNpi: number;
  priority: number;
  weight: number;
  maxConnections: number;
}

export interface AppConfig {
  name: string;
  env: string;
  port: number;
}

export interface LogConfig {
  level: string;
  format: string;
  console: {
    enabled: boolean;
  };
  file: {
    enabled: boolean;
    path: string;
    maxSize: string;
    maxFiles: string;
  };
  sensitiveFields: string[];
  requestBodyEnabled: boolean;
}

export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
}

export interface HealthCheckConfig {
  secret: string;
  providerCheckInterval: number;
  timestampTolerance: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
}

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  topics: {
    smsRequests: string;
    smsResponses: string;
    deadLetter: string;
  };
}

export interface Configuration {
  app: AppConfig;
  smpp: SmppConfig;
  providers: Record<string, ProviderConfig>;
  log: LogConfig;
  metrics: MetricsConfig;
  healthCheck: HealthCheckConfig;
  database: DatabaseConfig;
  kafka: KafkaConfig;
}

export default (): Configuration => ({
  app: {
    name: 'smpp-service',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '13000', 10),
  },
  smpp: {
    host: process.env.SMPP_HOST || '0.0.0.0',
    port: parseInt(process.env.SMPP_PORT || '2775', 10),
    systemId: process.env.SMPP_SYSTEM_ID || 'mock_smpp',
    password: process.env.SMPP_PASSWORD || 'password',
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
    ),
    logPdu: process.env.SMPP_LOG_PDU === 'true',
    logLevel: process.env.SMPP_LOG_LEVEL || 'info',
  },
  providers: {
    provider1: {
      enabled: process.env.PROVIDER1_ENABLED === 'true',
      host: process.env.PROVIDER1_HOST || 'smpp.provider1.com',
      port: parseInt(process.env.PROVIDER1_PORT || '2775', 10),
      systemId: process.env.PROVIDER1_SYSTEM_ID || 'user123',
      password: process.env.PROVIDER1_PASSWORD || 'pass123',
      systemType: process.env.PROVIDER1_SYSTEM_TYPE || 'SMPP',
      ton: parseInt(process.env.PROVIDER1_TON || '0', 10),
      npi: parseInt(process.env.PROVIDER1_NPI || '0', 10),
      addrTon: parseInt(process.env.PROVIDER1_ADDR_TON || '1', 10),
      addrNpi: parseInt(process.env.PROVIDER1_ADDR_NPI || '1', 10),
      priority: parseInt(process.env.PROVIDER1_PRIORITY || '1', 10),
      weight: parseInt(process.env.PROVIDER1_WEIGHT || '100', 10),
      maxConnections: parseInt(
        process.env.PROVIDER1_MAX_CONNECTIONS || '5',
        10,
      ),
    },
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED === 'true',
    },
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      path: process.env.LOG_FILE_PATH || 'logs/smpp-mock.log',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
    },
    sensitiveFields: (
      process.env.LOG_SENSITIVE_FIELDS || 'password,apiSecret,token'
    ).split(','),
    requestBodyEnabled: process.env.LOG_REQUEST_BODY_ENABLED === 'true',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    path: process.env.PROMETHEUS_METRICS_PATH || '/metrics',
  },
  healthCheck: {
    secret: process.env.HEALTH_CHECK_SECRET || 'test-secret',
    providerCheckInterval: parseInt(
      process.env.PROVIDER_HEALTH_CHECK_INTERVAL || '60000',
      10,
    ),
    timestampTolerance: parseInt(process.env.TIMESTAMP_TOLERANCE || '300', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_DATABASE || 'sms_serve',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'smpp-service',
    groupId: process.env.KAFKA_GROUP_ID || 'smpp-service-group',
    topics: {
      smsRequests: process.env.KAFKA_TOPICS_SMS_REQUESTS || 'sms-requests',
      smsResponses: process.env.KAFKA_TOPICS_SMS_RESPONSES || 'sms-responses',
      deadLetter: process.env.KAFKA_TOPICS_DEAD_LETTER || 'sms-dead-letter',
    },
  },
});
