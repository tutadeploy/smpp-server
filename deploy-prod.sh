#!/bin/bash

echo "=== 开始部署生产环境 ==="

# 1. 启动Docker服务
echo "启动生产环境Docker服务..."
docker compose -f docker-compose.prod.yml up -d

# 2. 等待服务准备就绪
echo "等待服务就绪..."
sleep 15

# 3. 构建应用
echo "构建应用..."
pnpm run build

# 4. 启动应用
echo "使用PM2启动应用..."
pm2 delete smpp-prod 2>/dev/null || true
pm2 start ecosystem.config.js --only smpp-prod --env production

# 5. 显示运行状态
echo "显示运行状态..."
pm2 show smpp-prod

echo "=== 生产环境部署完成 ==="
echo "API服务运行在: http://123.253.110.98:13000"
echo "API文档地址: http://123.253.110.98:13000/api-docs"
echo "Prometheus: http://123.253.110.98:9090"
echo "Grafana: http://123.253.110.98:3000"
