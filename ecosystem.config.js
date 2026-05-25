const path = require('path');

module.exports = {
  apps: [
    {
      name: 'lavalink-pro',
      script: './scripts/lavalink-wrapper.js',
      args: path.join(__dirname, 'lavalink', 'application.yml'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        SERVER_PORT: 2333,
        NODE_ENV: 'production',
        ...envVars
      },
      error_file: './lavalink/logs/pro-err.log',
      out_file: './lavalink/logs/pro-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 15000
    },
    {
      name: 'lavalink-free',
      script: './scripts/lavalink-wrapper.js',
      args: path.join(__dirname, 'lavalink', 'application-free.yml'),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        SERVER_PORT: 2334,
        NODE_ENV: 'production',
        ...envVars
      },
      error_file: './lavalink/logs/free-err.log',
      out_file: './lavalink/logs/free-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 15000
    },
    {
      name: 'ton618-music',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 10000
    }
  ]
};
