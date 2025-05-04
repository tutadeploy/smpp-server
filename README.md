# SMPP 服务

一个高性能的 SMPP 服务，具有连接池和批处理功能。

## 功能特点

- 连接池管理，高效利用资源
- 消息批量处理
- 完善的日志系统
- 指标收集和监控
- 全局异常处理
- 基于环境的配置

## 环境要求

- Node.js (v16 或更高版本)
- npm 或 yarn
- TypeScript (v5.1 或更高版本)

## 安装

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/smpp-serve.git
cd smpp-serve
```

2. 安装依赖：

```bash
npm install
```

3. 创建环境配置文件：

```bash
cp .env.example .env
```

4. 配置环境变量。

## 配置说明

服务可以通过环境变量进行配置。以下是主要的配置选项：

### 应用配置

- `APP_NAME`: 服务名称（默认：smpp-service）
- `APP_ENV`: 环境（development/production）
- `APP_PORT`: 服务端口（默认：13000）

### 日志配置

- `LOG_LEVEL`: 日志级别（默认：info）
- `LOG_FORMAT`: 日志格式（json/text）
- `LOG_CONSOLE_ENABLED`: 启用控制台日志
- `LOG_FILE_ENABLED`: 启用文件日志
- `LOG_FILE_PATH`: 日志文件路径
- `LOG_FILE_MAX_SIZE`: 最大日志文件大小
- `LOG_FILE_MAX_FILES`: 最大日志文件数量
- `LOG_ROTATE_ENABLED`: 启用日志轮转
- `LOG_ROTATE_PATH`: 轮转日志路径
- `LOG_ROTATE_MAX_SIZE`: 最大轮转日志大小
- `LOG_ROTATE_MAX_FILES`: 最大轮转日志数量
- `LOG_ROTATE_DATE_PATTERN`: 轮转日志日期格式

### 连接池配置

- `POOL_MIN_SIZE`: 最小池大小（默认：2）
- `POOL_MAX_SIZE`: 最大池大小（默认：10）
- `POOL_IDLE_TIMEOUT`: 空闲连接超时（毫秒）
- `POOL_ACQUIRE_TIMEOUT`: 获取连接超时（毫秒）
- `POOL_TEST_ON_BORROW`: 借用时测试连接

### 批处理配置

- `BATCH_MAX_SIZE`: 最大批处理大小（默认：100）
- `BATCH_MAX_WAIT_TIME`: 最大等待时间（毫秒）
- `BATCH_CONCURRENCY`: 并发处理数量

### 指标配置

- `METRICS_ENABLED`: 启用指标收集
- `METRICS_PORT`: 指标端口（默认：9090）
- `METRICS_PATH`: 指标路径（默认：/metrics）

### 数据库配置

- `DB_HOST`: 数据库主机
- `DB_PORT`: 数据库端口
- `DB_USERNAME`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_DATABASE`: 数据库名称
- `DB_SYNCHRONIZE`: 自动同步数据库架构

### Kafka 配置

- `KAFKA_BROKERS`: Kafka 代理服务器
- `KAFKA_CLIENT_ID`: Kafka 客户端 ID
- `KAFKA_GROUP_ID`: Kafka 组 ID
- `KAFKA_TOPICS_SMS_REQUESTS`: 短信请求主题
- `KAFKA_TOPICS_SMS_RESPONSES`: 短信响应主题
- `KAFKA_TOPICS_DEAD_LETTER`: 死信主题

### 提供商配置

- `ACTIVE_PROVIDER_ID`: 激活的SMPP提供商ID (默认: prod1)

## 提供商管理

系统支持多个SMPP提供商配置，通过数据库进行管理。默认情况下，系统预设了三个提供商：

1. `prod1`: 本地Mock提供商 (优先级: 10)
2. `prod2`: 测试服务器Mock (优先级: 20)
3. `prod3`: 生产环境提供商 (优先级: 5)

### 提供商选择

系统会根据以下规则选择SMPP提供商：

1. 如果设置了环境变量 `ACTIVE_PROVIDER_ID`，则使用指定的提供商。
2. 如果未设置，则使用在数据库 `providers` 表中状态为启用且优先级最高的提供商。

### 提供商切换

您可以通过两种方式切换提供商：

1. **启动时切换**：修改环境变量 `ACTIVE_PROVIDER_ID` 并重启服务。

```bash
export ACTIVE_PROVIDER_ID=prod3
npm run start:dev
```

2. **运行时切换**：通过API调用切换（需实现API接口）。

### 管理提供商

提供商信息存储在数据库 `providers` 表中，您可以通过数据库操作管理提供商：

```sql
-- 启用提供商
UPDATE providers SET status = 1 WHERE provider_id = 'prod3';

-- 禁用提供商
UPDATE providers SET status = 0 WHERE provider_id = 'prod2';

-- 添加新提供商
INSERT INTO providers (
    provider_id, provider_name, host, port, system_id, password, 
    source_addr, connect_timeout, request_timeout, 
    reconnect_interval, max_reconnect_attempts, priority, weight, status
) VALUES (
    'new_provider', '新提供商', 'smpp.example.com', 2775, 'username', 'password',
    'SMS', 30000, 45000, 5000, 3, 15, 100, 1
);
```

## 使用说明

### 开发环境

```