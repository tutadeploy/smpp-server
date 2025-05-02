import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '13000', 10),

  // 数据库基本配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    database: process.env.DB_DATABASE || 'sms_serve',
  },

  // Kafka配置
  kafka: {
    broker: {
      id: parseInt(process.env.KAFKA_BROKER_ID || '1', 10),
      internalPort: parseInt(process.env.KAFKA_INTERNAL_PORT || '9092', 10),
      externalPort: parseInt(process.env.KAFKA_EXTERNAL_PORT || '29092', 10),
      internalHost: process.env.KAFKA_INTERNAL_HOST || 'kafka',
      externalHost: process.env.KAFKA_EXTERNAL_HOST || 'localhost',
    },
    client: {
      clientId: process.env.KAFKA_CLIENT_ID || 'smpp-serve',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      groupId: process.env.KAFKA_GROUP_ID || 'smpp-serve-group',
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
    topics: {
      outbound: process.env.KAFKA_TOPIC_OUTBOUND || 'sms.outbound',
      status: process.env.KAFKA_TOPIC_STATUS || 'sms.status',
      partitions: parseInt(process.env.KAFKA_TOPIC_PARTITIONS || '3', 10),
    },
  },

  // ZooKeeper配置
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
      retries: parseInt(process.env.ZOOKEEPER_HEALTH_CHECK_RETRIES || '5', 10),
    },
  },

  // SMPP配置
  smpp: {
    providers: [
      {
        name: 'default',
        host: process.env.SMPP_HOST || 'localhost',
        port: parseInt(process.env.SMPP_PORT || '2775', 10),
        systemId: process.env.SMPP_SYSTEM_ID || 'mock_smpp',
        password: process.env.SMPP_PASSWORD || 'password',
        systemType: '',
        addressRange: '',
        enquireLinkTimer: 30000,
        reconnectTimer: 5000,
        maxConnections: 1,
      },
    ],
  },

  // 监控配置
  monitoring: {
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

  // 数据卷配置
  volumes: {
    postgresData: 'postgres_data',
    pgadminData: 'pgadmin_data',
    prometheusData: 'prometheus_data',
    grafanaData: 'grafana_data',
  },
}));
