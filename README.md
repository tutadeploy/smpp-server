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
- `APP_PORT`: 服务端口（默认：3000）

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

## 使用说明

### 开发环境

```bash
npm run start:dev
```

### 生产环境

```bash
npm run build
npm run start:prod
```

### 测试

```bash
npm run test
npm run test:cov
```

## 系统架构

服务使用 NestJS 框架构建，采用模块化架构：

- `src/common`: 共享工具和服务
  - `logger`: 日志服务
  - `metrics`: 指标收集服务
  - `filters`: 全局异常过滤器
- `src/services`: 核心业务服务
  - `connection-pool`: 连接池管理
  - `message-batch`: 消息批处理
- `src/config`: 配置管理

## 许可证

本项目采用 ISC 许可证。
