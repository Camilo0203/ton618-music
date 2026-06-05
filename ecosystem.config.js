const path = require('path');
const fs = require('fs');

const envVars = {};
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && !key.startsWith('#')) envVars[key] = val;
    }
  }
}

module.exports = {
  apps: [
    {
      name: 'lavalink',
      script: './scripts/lavalink-wrapper.js',
      args: path.join(__dirname, 'lavalink', 'application-vps.yml'),
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        SERVER_PORT: 2333,
        NODE_ENV: 'production',
        PROXY_HOST: '89.35.94.72',
        PROXY_PORT: '12323',
        PROXY_USER: '14a76da825113',
        PROXY_PASSWORD: 'f3b13bd96a',
        ...envVars
      },
      error_file: './lavalink/logs/lavalink-err.log',
      out_file: './lavalink/logs/lavalink-out.log',
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
        NODE_ENV: 'production',
        ...envVars
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 10000
    }
  ]
};
