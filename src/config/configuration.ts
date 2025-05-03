import { Service } from '../entities/service.entity';
import { Account } from '../entities/account.entity';
import { Message } from '../entities/message.entity';
import { StatusReport } from '../entities/status-report.entity';
import { Provider } from '../entities/provider.entity';
import { Transaction } from '../entities/transaction.entity';
import { ConsumerConfig, ProducerConfig } from 'kafkajs';

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
  providers?: Array<{
    name: string;
    host: string;
    port: number;
    systemId: string;
    password: string;
    systemType: string;
    addressRange: string;
    enquireLinkTimer: number;
    reconnectTimer: number;
    maxConnections: number;
  }>;
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
  requestBody?: {
    enabled: boolean;
  };
}

export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
  prometheus?: {
    port: number;
    auth: {
      username: string;
      password: string;
    };
    storage: {
      tsdbPath: string;
      retention: string;
    };
    targets: {
      smppService: string;
      kafka: string;
      self: string;
    };
    webConfig: {
      enableLifecycle: boolean;
      enableAdminApi: boolean;
    };
  };
  grafana?: {
    port: number;
    auth: {
      username: string;
      password: string;
      allowSignUp: boolean;
    };
    datasources: {
      prometheus: {
        name: string;
        type: string;
        url: string;
        access: string;
      };
    };
    provisioning: {
      path: string;
    };
  };
  kafkaUi?: {
    port: number;
    auth: {
      type: string;
      username: string;
      password: string;
    };
    cluster: {
      name: string;
      bootstrapServers: string;
      zookeeper: string;
    };
  };
}

export interface HealthCheckConfig {
  secret: string;
  providerCheckInterval: number;
  timestampTolerance: number;
}

export interface DatabaseConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  entities: any[];
  logging: any;
  maxQueryExecutionTime: number;
  ssl: boolean;
  extra: {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}

export interface KafkaTopicsConfig {
  smsRequests: string;
  smsResponses: string;
  deadLetter: string;
  statusReportDeadLetter: string;
  sms: string; // 兼容性名称
  statusReports: string; // 兼容性名称
  outbound?: string;
  status?: string;
  partitions?: number;
}

export interface KafkaBrokerConfig {
  id?: number;
  internalPort?: number;
  externalPort?: number;
  internalHost?: string;
  externalHost?: string;
}

export interface KafkaAuthConfig {
  username?: string;
  password?: string;
}

export interface KafkaAdvancedConfig {
  autoCreateTopics?: boolean;
  replicationFactor?: number;
  messageMaxBytes?: number;
  replicaFetchMaxBytes?: number;
  fetchMessageMaxBytes?: number;
  maxRequestSize?: number;
  socketRequestMaxBytes?: number;
  maxPartitionFetchBytes?: number;
  socketReceiveBufferBytes?: number;
  socketSendBufferBytes?: number;
  heapOpts?: string;
  jvmPerformanceOpts?: string;
}

export interface KafkaRetryConfig {
  retries: number;
  initialRetryTime: number;
  maxRetryTime: number;
  factor: number;
}

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  topics: KafkaTopicsConfig;
  producer: ProducerConfig;
  consumer: ConsumerConfig;
  logLevel: string;
  noPartitionerWarning: boolean;
  logCreator?: () => (entry: any) => void;
  broker?: KafkaBrokerConfig;
  auth?: KafkaAuthConfig;
  config?: KafkaAdvancedConfig;
}

export interface ZookeeperConfig {
  port: number;
  adminPort: number;
  tickTime: number;
  adminEnable: boolean;
  auth: {
    username: string;
    password: string;
  };
  healthCheck: {
    command: string;
    interval: number;
    timeout: number;
    retries: number;
  };
}

export interface VolumesConfig {
  postgresData: string;
  pgadminData: string;
  prometheusData: string;
  grafanaData: string;
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
  zookeeper?: ZookeeperConfig;
  volumes?: VolumesConfig;
}

export default (): Configuration => {
  // 基础重试配置
  const kafkaRetryConfig = {
    retries: 10,
    initialRetryTime: 1000, // 1秒
    maxRetryTime: 30000, // 30秒
    factor: 2,
  };

  // 生产者配置
  const kafkaProducerConfig: ProducerConfig = {
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
    idempotent: true, // 确保消息只发送一次
    maxInFlightRequests: 5,
    retry: kafkaRetryConfig,
  };

  // 消费者配置
  const groupId = process.env.KAFKA_GROUP_ID || 'smpp-service-group';
  const kafkaConsumerConfig: ConsumerConfig = {
    groupId,
    maxWaitTimeInMs: 5000,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    retry: kafkaRetryConfig,
    allowAutoTopicCreation: true,
  };

  return {
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
      // 移除硬编码的提供商配置，改为从数据库中加载
    },
    log: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      console: {
        enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      },
      file: {
        enabled: process.env.LOG_FILE_ENABLED !== 'false',
        path: process.env.LOG_FILE_PATH || 'logs/app.log',
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
      prometheus: {
        port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
        auth: {
          username: process.env.PROMETHEUS_USERNAME || 'admin',
          password: process.env.PROMETHEUS_PASSWORD || 'admin123',
        },
        storage: {
          tsdbPath: '/prometheus',
          retention: '15d',
        },
        targets: {
          smppService:
            process.env.PROMETHEUS_SMPP_TARGET || 'host.docker.internal:3000',
          kafka: process.env.PROMETHEUS_KAFKA_TARGET || 'kafka:9092',
          self: 'localhost:9090',
        },
        webConfig: {
          enableLifecycle: true,
          enableAdminApi: true,
        },
      },
      grafana: {
        port: parseInt(process.env.GRAFANA_PORT || '3000', 10),
        auth: {
          username: process.env.GRAFANA_USERNAME || 'admin',
          password: process.env.GRAFANA_PASSWORD || 'admin123',
          allowSignUp: process.env.GRAFANA_ALLOW_SIGNUP === 'true',
        },
        datasources: {
          prometheus: {
            name: 'Prometheus',
            type: 'prometheus',
            url: process.env.GRAFANA_PROMETHEUS_URL || 'http://prometheus:9090',
            access: 'proxy',
          },
        },
        provisioning: {
          path: '/etc/grafana/provisioning',
        },
      },
      kafkaUi: {
        port: parseInt(process.env.KAFKA_UI_PORT || '8080', 10),
        auth: {
          type: process.env.KAFKA_UI_AUTH_TYPE || 'DISABLED',
          username: process.env.KAFKA_UI_USERNAME || 'admin',
          password: process.env.KAFKA_UI_PASSWORD || 'admin123',
        },
        cluster: {
          name: process.env.KAFKA_UI_CLUSTER_NAME || 'local',
          bootstrapServers:
            process.env.KAFKA_UI_BOOTSTRAP_SERVERS || 'kafka:9092',
          zookeeper: process.env.KAFKA_UI_ZOOKEEPER || 'zookeeper:2181',
        },
      },
    },
    healthCheck: {
      secret: process.env.HEALTH_CHECK_SECRET || 'test-secret',
      providerCheckInterval: parseInt(
        process.env.PROVIDER_HEALTH_CHECK_INTERVAL || '60000',
        10,
      ),
      timestampTolerance: parseInt(
        process.env.TIMESTAMP_TOLERANCE || '300',
        10,
      ),
    },
    database: {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_DATABASE || 'sms_serve',
      entities: [
        Service,
        Account,
        Message,
        StatusReport,
        Provider,
        Transaction,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'false',
      logging: ['error'],
      maxQueryExecutionTime: 0,
      ssl: process.env.DB_SSL === 'true',
      extra: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    },
    kafka: {
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'smpp-service',
      groupId: process.env.KAFKA_GROUP_ID || 'smpp-service-group',
      topics: {
        smsRequests: process.env.KAFKA_TOPICS_SMS_REQUESTS || 'sms-requests',
        smsResponses: process.env.KAFKA_TOPICS_SMS_RESPONSES || 'sms-responses',
        deadLetter: process.env.KAFKA_TOPICS_DEAD_LETTER || 'sms-dead-letter',
        statusReportDeadLetter:
          process.env.KAFKA_TOPICS_STATUS_REPORT_DEAD_LETTER ||
          'status-report-dead-letter',
        sms: process.env.KAFKA_TOPIC_SMS || 'sms',
        statusReports:
          process.env.KAFKA_TOPIC_STATUS_REPORTS || 'status-reports',
        outbound: process.env.KAFKA_TOPIC_OUTBOUND || 'sms.outbound',
        status: process.env.KAFKA_TOPIC_STATUS || 'sms.status',
        partitions: parseInt(process.env.KAFKA_TOPIC_PARTITIONS || '3', 10),
      },
      producer: kafkaProducerConfig,
      consumer: kafkaConsumerConfig,
      logLevel: 'NOTHING',
      noPartitionerWarning: true,
      logCreator: () => () => {
        return {};
      },
      broker: {
        id: parseInt(process.env.KAFKA_BROKER_ID || '1', 10),
        internalPort: parseInt(process.env.KAFKA_INTERNAL_PORT || '9092', 10),
        externalPort: parseInt(process.env.KAFKA_EXTERNAL_PORT || '29092', 10),
        internalHost: process.env.KAFKA_INTERNAL_HOST || 'kafka',
        externalHost: process.env.KAFKA_EXTERNAL_HOST || 'localhost',
      },
      auth: {
        username: process.env.KAFKA_USERNAME || 'admin',
        password: process.env.KAFKA_PASSWORD || 'admin123',
      },
      config: {
        autoCreateTopics: process.env.KAFKA_AUTO_CREATE_TOPICS === 'true',
        replicationFactor: parseInt(
          process.env.KAFKA_REPLICATION_FACTOR || '1',
          10,
        ),
        messageMaxBytes: parseInt(
          process.env.KAFKA_MESSAGE_MAX_BYTES || '2000000000',
          10,
        ),
        replicaFetchMaxBytes: parseInt(
          process.env.KAFKA_REPLICA_FETCH_MAX_BYTES || '2000000000',
          10,
        ),
        fetchMessageMaxBytes: parseInt(
          process.env.KAFKA_FETCH_MESSAGE_MAX_BYTES || '2000000000',
          10,
        ),
        maxRequestSize: parseInt(
          process.env.KAFKA_MAX_REQUEST_SIZE || '2000000000',
          10,
        ),
        socketRequestMaxBytes: parseInt(
          process.env.KAFKA_SOCKET_REQUEST_MAX_BYTES || '2000000000',
          10,
        ),
        maxPartitionFetchBytes: parseInt(
          process.env.KAFKA_MAX_PARTITION_FETCH_BYTES || '2000000000',
          10,
        ),
        socketReceiveBufferBytes: parseInt(
          process.env.KAFKA_SOCKET_RECEIVE_BUFFER_BYTES || '2000000000',
          10,
        ),
        socketSendBufferBytes: parseInt(
          process.env.KAFKA_SOCKET_SEND_BUFFER_BYTES || '2000000000',
          10,
        ),
        heapOpts: process.env.KAFKA_HEAP_OPTS || '-Xmx4G -Xms4G',
        jvmPerformanceOpts:
          process.env.KAFKA_JVM_PERFORMANCE_OPTS ||
          '-XX:MetaspaceSize=96m -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:G1HeapRegionSize=16M -XX:MinMetaspaceFreeRatio=50 -XX:MaxMetaspaceFreeRatio=80',
      },
    },
    zookeeper: {
      port: parseInt(process.env.ZOOKEEPER_PORT || '2181', 10),
      adminPort: parseInt(process.env.ZOOKEEPER_ADMIN_PORT || '8080', 10),
      tickTime: parseInt(process.env.ZOOKEEPER_TICK_TIME || '2000', 10),
      adminEnable: process.env.ZOOKEEPER_ADMIN_ENABLE_SERVER === 'true',
      auth: {
        username: process.env.ZOOKEEPER_USERNAME || 'admin',
        password: process.env.ZOOKEEPER_PASSWORD || 'admin123',
      },
      healthCheck: {
        command: 'echo srvr | nc zookeeper 2181 || exit 1',
        interval: parseInt(
          process.env.ZOOKEEPER_HEALTH_CHECK_INTERVAL || '10000',
          10,
        ),
        timeout: parseInt(
          process.env.ZOOKEEPER_HEALTH_CHECK_TIMEOUT || '5000',
          10,
        ),
        retries: parseInt(
          process.env.ZOOKEEPER_HEALTH_CHECK_RETRIES || '5',
          10,
        ),
      },
    },
    volumes: {
      postgresData: 'postgres_data',
      pgadminData: 'pgadmin_data',
      prometheusData: 'prometheus_data',
      grafanaData: 'grafana_data',
    },
  };
};
