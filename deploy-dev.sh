#!/bin/bash

echo "=== 开始部署开发环境 ==="

# 1. 启动Docker服务
echo "启动开发环境Docker服务..."
docker compose up -d postgres zookeeper kafka pgadmin kafka-ui

# 2. 等待服务准备就绪
echo "等待服务就绪..."
sleep 15

# 3. 构建应用
echo "构建应用..."
pnpm run build

# 4. 启动应用
echo "使用PM2启动应用..."
pm2 delete smpp-dev 2>/dev/null || true
pm2 start ecosystem.config.js --only smpp-dev --env development

# 5. 显示运行状态
echo "显示运行状态..."
pm2 show smpp-dev

echo "=== 开发环境部署完成 ==="
echo "API服务运行在: http://localhost:13000"
echo "API文档地址: http://localhost:13000/api-docs"
echo "Kafka管理界面: http://localhost:8080"
echo "PgAdmin界面: http://localhost:5050"
