-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建服务表
CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,
    service_id VARCHAR(32) NOT NULL UNIQUE, -- 服务ID，唯一标识
    service_name VARCHAR(64) NOT NULL, -- 服务名称
    api_key VARCHAR(64) NOT NULL UNIQUE, -- API密钥，用于认证
    api_secret VARCHAR(128) NOT NULL, -- API密钥对应的密钥
    status SMALLINT NOT NULL DEFAULT 1, -- 服务状态：1-启用，0-禁用
    sign_type VARCHAR(16) NOT NULL DEFAULT 'md5', -- 签名类型：md5, hmac, rsa
    sign_key VARCHAR(256), -- 用于HMAC或RSA签名的密钥
    sign_tolerance INTEGER NOT NULL DEFAULT 300, -- 签名时间戳容差（秒）
    request_limit INTEGER NOT NULL DEFAULT 1000, -- 每秒请求限制
    ip_whitelist TEXT[], -- IP白名单列表
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    CONSTRAINT valid_sign_type CHECK (sign_type IN ('md5', 'hmac', 'rsa'))
);

CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_api_key ON services(api_key);

-- 创建账户表
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- 账户唯一标识
    app_id VARCHAR(64) NOT NULL UNIQUE, -- 应用ID，唯一标识
    app_name VARCHAR(128) NOT NULL, -- 应用名称
    service_id VARCHAR(32) NOT NULL, -- 关联的服务ID
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.0, -- 实际可用余额
    gift_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.0, -- 赠送余额
    credit_limit DECIMAL(10, 2) NOT NULL DEFAULT 0.0, -- 信用额度
    credit_used DECIMAL(10, 2) NOT NULL DEFAULT 0.0, -- 已使用信用额度
    daily_limit INTEGER NOT NULL DEFAULT 10000, -- 每日发送限制
    monthly_limit INTEGER NOT NULL DEFAULT 300000, -- 每月发送限制
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 账户状态：ACTIVE-激活，INACTIVE-未激活
    api_key VARCHAR(64), -- API密钥，用于接口认证
    active BOOLEAN NOT NULL DEFAULT true, -- 是否激活：true-激活，false-未激活
    settings JSONB, -- 账户配置信息，JSON格式
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_app_id ON accounts(app_id);
CREATE INDEX IF NOT EXISTS idx_accounts_service_id ON accounts(service_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- 创建交易表
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- 交易记录ID
    account_id UUID NOT NULL, -- 关联的账户ID
    app_id VARCHAR(64) NOT NULL, -- 关联的应用ID
    amount DECIMAL(10, 2) NOT NULL, -- 交易金额
    balance DECIMAL(10, 2) NOT NULL, -- 交易前余额
    balance_after DECIMAL(10, 2) NOT NULL, -- 交易后余额
    credit_used DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 交易前已用信用额度
    credit_used_after DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 交易后已用信用额度
    type VARCHAR(20) NOT NULL DEFAULT 'RECHARGE' CHECK (type IN ('RECHARGE', 'DEDUCT', 'REFUND', 'GIFT')), -- 交易类型，默认RECHARGE
    description TEXT NOT NULL, -- 交易描述
    metadata JSONB, -- 交易元数据
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (app_id) REFERENCES accounts(app_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_app_id ON transactions(app_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 创建消息表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- 消息唯一标识
    message_id VARCHAR(64) NOT NULL UNIQUE, -- 消息ID，用于外部引用
    app_id VARCHAR(64) NOT NULL, -- 关联的应用ID
    "phoneNumber" VARCHAR(20) NOT NULL, -- 接收手机号码（加双引号，严格区分大小写）
    content TEXT NOT NULL, -- 短信内容
    sender_id VARCHAR(32), -- 发送者ID
    order_id VARCHAR(64), -- 客户订单ID
    "provider_message_id" VARCHAR(64), -- 提供商生成的消息ID（加双引号）
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUEUED', 'SENDING', 'DELIVERED', 'FAILED', 'ERROR', 'PROCESSING', 'EXPIRED')), -- 消息状态
    "error_message" TEXT, -- 错误信息（加双引号）
    "retry_count" INTEGER NOT NULL DEFAULT 0, -- 重试次数（加双引号）
    priority INTEGER NOT NULL DEFAULT 1, -- 优先级
    "schedule_time" TIMESTAMP WITH TIME ZONE, -- 计划发送时间（加双引号）
    "send_time" TIMESTAMP WITH TIME ZONE, -- 实际发送时间（加双引号）
    "update_time" TIMESTAMP WITH TIME ZONE, -- 最后更新时间（加双引号）
    metadata JSONB, -- 消息元数据
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间（加双引号）
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间（加双引号）
    FOREIGN KEY (app_id) REFERENCES accounts(app_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_app_id ON messages(app_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages("created_at");
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages("provider_message_id");
CREATE INDEX IF NOT EXISTS idx_messages_phoneNumber ON messages("phoneNumber");

-- 创建状态报告表
CREATE TABLE IF NOT EXISTS status_reports (
    id BIGSERIAL PRIMARY KEY, -- 状态报告ID
    message_id VARCHAR(36) NOT NULL, -- 关联的消息ID
    phone_number VARCHAR(32) NOT NULL, -- 手机号码
    provider_id VARCHAR(32) NOT NULL, -- 提供商ID
    provider_message_id VARCHAR(64) NOT NULL, -- 提供商生成的消息ID
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 状态：PENDING-待处理，DELIVERED-已送达，FAILED-失败，EXPIRED-过期
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
    id BIGSERIAL PRIMARY KEY, -- 提供商ID
    provider_id VARCHAR(32) NOT NULL UNIQUE, -- 提供商唯一标识
    provider_name VARCHAR(64) NOT NULL, -- 提供商名称
    host VARCHAR(128) NOT NULL, -- SMPP服务器地址
    port INTEGER NOT NULL, -- SMPP服务器端口
    system_id VARCHAR(64) NOT NULL, -- SMPP系统ID
    password VARCHAR(128) NOT NULL, -- SMPP密码
    source_addr VARCHAR(20), -- 源地址
    connect_timeout INTEGER NOT NULL DEFAULT 30000, -- 连接超时时间（毫秒）
    request_timeout INTEGER NOT NULL DEFAULT 45000, -- 请求超时时间（毫秒）
    reconnect_interval INTEGER NOT NULL DEFAULT 10000, -- 重连间隔（毫秒）
    max_reconnect_attempts INTEGER NOT NULL DEFAULT 3, -- 最大重连次数
    priority INTEGER NOT NULL DEFAULT 10, -- 优先级
    weight INTEGER NOT NULL DEFAULT 100, -- 权重
    status SMALLINT NOT NULL DEFAULT 1, -- 状态：1-启用，0-禁用
    system_type VARCHAR(64), -- 系统类型
    max_connections INTEGER NOT NULL DEFAULT 5, -- 最大连接数
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_priority ON providers(priority);
CREATE INDEX IF NOT EXISTS idx_providers_provider_id ON providers(provider_id);

-- 创建价格方案表
CREATE TABLE IF NOT EXISTS price_plans (
    id BIGSERIAL PRIMARY KEY, -- 价格方案ID
    plan_id VARCHAR(32) NOT NULL UNIQUE, -- 价格方案唯一标识
    plan_name VARCHAR(64) NOT NULL, -- 价格方案名称
    base_price DECIMAL(10, 5) NOT NULL, -- 基础单价
    description TEXT, -- 方案描述
    status SMALLINT NOT NULL DEFAULT 1, -- 状态：1-启用，0-禁用
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

CREATE TABLE IF NOT EXISTS price_rules (
    id BIGSERIAL PRIMARY KEY, -- 价格规则ID
    plan_id VARCHAR(32) NOT NULL, -- 关联的价格方案ID
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

INSERT INTO accounts (id, app_id, app_name, service_id, balance, gift_balance, credit_limit, credit_used, daily_limit, monthly_limit, status, active)
VALUES (uuid_generate_v4(), 'ADMIN', '管理后台', 'admin', 0.0, 0.0, 0.0, 0.0, 10000, 300000, 'ACTIVE', true)
ON CONFLICT (app_id) DO NOTHING;

-- 删除原有的测试提供商，添加三个SMPP提供商配置
DELETE FROM providers;

-- 提供商1 - 本地测试用(Mock)
INSERT INTO providers (
    provider_id, provider_name, host, port, system_id, password, source_addr, connect_timeout, request_timeout, reconnect_interval, max_reconnect_attempts, priority, weight, status, system_type, max_connections, created_at, updated_at
) VALUES (
    'prod1', '本地Mock供应商', 'localhost', 2775, 'mock_smpp', 'password', 'TEST', 30000, 45000, 5000, 3, 10, 100, 1, 'mock', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
), (
    'prod2', '测试服务器Mock', '123.253.110.98', 2775, 'mock_smpp', 'password', 'TEST', 30000, 45000, 5000, 3, 20, 50, 1, 'mock', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
), (
    'prod3', '生产环境供应商', '165.84.188.148', 2775, 'MBC137', 'qg7Iuhn7', 'SMS', 30000, 45000, 5000, 3, 5, 200, 1, 'MBC', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT (provider_id) DO UPDATE SET 
    provider_name = EXCLUDED.provider_name,
    host = EXCLUDED.host,
    port = EXCLUDED.port,
    system_id = EXCLUDED.system_id,
    password = EXCLUDED.password,
    updated_at = CURRENT_TIMESTAMP; 