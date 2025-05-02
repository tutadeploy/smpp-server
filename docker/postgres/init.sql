-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建服务表
CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,
    service_id VARCHAR(32) NOT NULL UNIQUE,
    service_name VARCHAR(64) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    api_secret VARCHAR(128) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1, -- 1: 启用, 0: 禁用
    sign_type VARCHAR(16) NOT NULL DEFAULT 'md5', -- 签名类型：md5, hmac, rsa
    sign_key VARCHAR(256), -- 用于HMAC或RSA签名的密钥
    sign_tolerance INTEGER NOT NULL DEFAULT 300, -- 签名时间戳容差（秒）
    request_limit INTEGER NOT NULL DEFAULT 1000, -- 每秒请求限制
    ip_whitelist TEXT[], -- IP白名单
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_sign_type CHECK (sign_type IN ('md5', 'hmac', 'rsa'))
);

CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_api_key ON services(api_key);

-- 创建账户表
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(64) NOT NULL UNIQUE,
    app_name VARCHAR(128) NOT NULL,
    service_id VARCHAR(32) NOT NULL,
    balance DECIMAL(12, 5) NOT NULL DEFAULT 0.0, -- 实际可用余额
    gift_balance DECIMAL(12, 5) NOT NULL DEFAULT 0.0, -- 赠送余额
    credit_limit DECIMAL(12, 5) NOT NULL DEFAULT 0.0, -- 信用额度
    credit_used DECIMAL(12, 5) NOT NULL DEFAULT 0.0, -- 已使用信用额度
    daily_limit INTEGER NOT NULL DEFAULT 10000, -- 每日发送限制
    status SMALLINT NOT NULL DEFAULT 1, -- 1: 启用, 0: 禁用
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_app_id ON accounts(app_id);
CREATE INDEX IF NOT EXISTS idx_accounts_service_id ON accounts(service_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- 创建交易表
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    app_id VARCHAR(32) NOT NULL,
    amount DECIMAL(12, 5) NOT NULL, -- 交易金额，正数表示充值，负数表示消费
    type VARCHAR(20) NOT NULL, -- 交易类型: RECHARGE, DEDUCT, REFUND
    description TEXT, -- 交易描述
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES accounts(app_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_app_id ON transactions(app_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 创建消息表
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    message_id VARCHAR(36) NOT NULL UNIQUE, -- 添加UNIQUE约束，便于外键引用
    app_id VARCHAR(32) NOT NULL,
    content TEXT NOT NULL, -- 短信内容
    sender_id VARCHAR(32), -- 发送者ID
    provider_message_id VARCHAR(64), -- 提供商生成的消息ID
    status VARCHAR(20) NOT NULL, -- 状态: QUEUED, SENDING, SENT, DELIVERED, FAILED, ERROR
    error_message TEXT, -- 错误信息
    order_id VARCHAR(64), -- 客户订单ID
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES accounts(app_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_app_id ON messages(app_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages(provider_message_id);

-- 创建状态报告表
CREATE TABLE IF NOT EXISTS status_reports (
    id BIGSERIAL PRIMARY KEY,
    message_id VARCHAR(36) NOT NULL, -- 关联的消息ID
    provider_id VARCHAR(32) NOT NULL, -- 提供商ID
    provider_message_id VARCHAR(64) NOT NULL, -- 提供商生成的消息ID
    status VARCHAR(20) NOT NULL, -- 状态: DELIVERED, FAILED, PENDING
    error_code VARCHAR(20), -- 错误代码
    error_message TEXT, -- 错误信息
    delivered_at TIMESTAMP WITH TIME ZONE, -- 送达时间
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 报告接收时间
    raw_data TEXT, -- 原始状态报告数据
    FOREIGN KEY (message_id) REFERENCES messages(message_id)
);

CREATE INDEX IF NOT EXISTS idx_status_reports_message_id ON status_reports(message_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_provider_message_id ON status_reports(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_status ON status_reports(status);
CREATE INDEX IF NOT EXISTS idx_status_reports_delivered_at ON status_reports(delivered_at);

-- 创建提供商表
CREATE TABLE IF NOT EXISTS providers (
    id BIGSERIAL PRIMARY KEY,
    provider_id VARCHAR(32) NOT NULL UNIQUE,
    provider_name VARCHAR(64) NOT NULL,
    host VARCHAR(128) NOT NULL, -- SMPP服务器地址
    port INTEGER NOT NULL, -- SMPP服务器端口
    system_id VARCHAR(64) NOT NULL, -- SMPP系统ID(用户名)
    password VARCHAR(128) NOT NULL, -- SMPP密码
    source_addr VARCHAR(20), -- 默认源地址
    connect_timeout INTEGER NOT NULL DEFAULT 30000, -- 连接超时时间(毫秒)
    request_timeout INTEGER NOT NULL DEFAULT 45000, -- 请求超时时间(毫秒)
    reconnect_interval INTEGER NOT NULL DEFAULT 10000, -- 重连间隔(毫秒)
    max_reconnect_attempts INTEGER NOT NULL DEFAULT 3, -- 最大重连次数
    priority INTEGER NOT NULL DEFAULT 10, -- 优先级，数字越小优先级越高
    weight INTEGER NOT NULL DEFAULT 100, -- 权重，用于负载均衡
    status SMALLINT NOT NULL DEFAULT 1, -- 1: 启用, 0: 禁用
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_priority ON providers(priority);

-- 创建价格方案表
CREATE TABLE IF NOT EXISTS price_plans (
    id BIGSERIAL PRIMARY KEY,
    plan_id VARCHAR(32) NOT NULL UNIQUE,
    plan_name VARCHAR(64) NOT NULL,
    base_price DECIMAL(10, 5) NOT NULL, -- 基础单价
    description TEXT,
    status SMALLINT NOT NULL DEFAULT 1, -- 1: 启用, 0: 禁用
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_rules (
    id BIGSERIAL PRIMARY KEY,
    plan_id VARCHAR(32) NOT NULL,
    country_code VARCHAR(8), -- 国家代码，NULL表示适用所有国家
    operator_code VARCHAR(16), -- 运营商代码，NULL表示适用所有运营商
    price DECIMAL(10, 5) NOT NULL, -- 特定国家和运营商的单价
    min_volume INTEGER, -- 最小计费量
    max_volume INTEGER, -- 最大计费量
    FOREIGN KEY (plan_id) REFERENCES price_plans(plan_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_rules_plan_id ON price_rules(plan_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_country_code ON price_rules(country_code);

-- 创建测试数据
-- 只保留admin服务和账号
INSERT INTO services (service_id, service_name, api_key, api_secret, status, sign_type, sign_tolerance, request_limit)
VALUES ('admin', '管理后台', 'admin', 'admin123', 1, 'md5', 300, 1000)
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO accounts (id, app_id, app_name, service_id, balance, gift_balance, credit_limit, credit_used, daily_limit, status)
VALUES (uuid_generate_v4(), 'ADMIN', '管理后台', 'admin', 0.0, 0.0, 0.0, 0.0, 10000, 1)
ON CONFLICT (app_id) DO NOTHING;

INSERT INTO providers (provider_id, provider_name, host, port, system_id, password, source_addr)
VALUES ('PROVIDER1', '测试提供商', 'smpp.example.com', 2775, 'admin', 'admin123', 'TEST')
ON CONFLICT (provider_id) DO NOTHING; 