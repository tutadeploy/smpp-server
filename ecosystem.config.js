module.exports = {
  apps: [
    // 开发环境
    {
      name: 'smpp-dev',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        ACTIVE_PROVIDER_ID: 'prod1',
        DEBUG: '*',
        PORT: 13000
      },
      env_file: '.env.dev',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      log_file: 'logs/dev/combined.log',
      error_file: 'logs/dev/error.log',
      out_file: 'logs/dev/output.log',
      time: true,
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      max_restarts: 10,
      restart_delay: 4000,
    },
    
    // 测试环境
    {
      name: 'smpp-test',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'test',
        ACTIVE_PROVIDER_ID: 'prod2',
        PORT: 13000
      },
      env_file: '.env.test',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      log_file: 'logs/test/combined.log',
      error_file: 'logs/test/error.log',
      out_file: 'logs/test/output.log',
      time: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
    },
    
    // 生产环境
    {
      name: 'smpp-prod',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ACTIVE_PROVIDER_ID: 'prod3',
        PORT: 13000
      },
      env_file: '.env.prod',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      log_file: 'logs/prod/combined.log',
      error_file: 'logs/prod/error.log',
      out_file: 'logs/prod/output.log',
      time: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
    }
  ],
};