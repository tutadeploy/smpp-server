module.exports = {
  apps: [
    {
      name: 'smpp-service',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      log_file: 'logs/combined.log',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
    },
  ],
};
