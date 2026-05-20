module.exports = {
  apps: [
    {
      name: 'lavalink',
      cwd: './lavalink',
      script: 'java',
      args: '-jar Lavalink.jar',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        SERVER_PORT: 2333
      },
      error_file: './lavalink/logs/err.log',
      out_file: './lavalink/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 10000
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
