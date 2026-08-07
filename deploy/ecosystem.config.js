module.exports = {
  apps: [
    {
      name: 'zhudatuan',
      cwd: '/var/www/zhudatuan',
      script: 'npm',
      args: 'run start',
      interpreter: '/usr/bin/node',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        APP_ENV: 'production',
        AUTH_MODE: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '/var/log/pm2/zhudatuan-error.log',
      out_file: '/var/log/pm2/zhudatuan-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
