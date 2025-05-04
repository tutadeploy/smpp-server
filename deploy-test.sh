#!/bin/bash

echo "=== 开始部署测试环境 ==="

# 1. 启动Docker服务
echo "启动测试环境Docker服务..."
docker compose -f docker-compose.test.yml up -d

# 2. 等待服务准备就绪
echo "等待服务就绪..."
sleep 15

# 3. 构建应用
echo "构建应用..."
pnpm run build

# 4. 启动应用
echo "使用PM2启动应用..."
pm2 delete smpp-test 2>/dev/null || true
pm2 start ecosystem.config.js --only smpp-test --env test

# 5. 显示运行状态
echo "显示运行状态..."
pm2 show smpp-test

echo "=== 测试环境部署完成 ==="
echo "API服务运行在: http://123.253.110.98:13000"
echo "API文档地址: http://123.253.110.98:13000/api-docs"
