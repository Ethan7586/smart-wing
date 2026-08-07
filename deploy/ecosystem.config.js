module.exports = {
  apps: [
    {
      name: 'zhudatuan',
      cwd: '/var/www/zhudatuan',
      script: 'node_modules/vinext/dist/cli.js',
      args: 'start',
      // SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SESSION_SIGNING_KEY /
      // PII_ENCRYPTION_KEY / DEMO_LOGIN_CODE must NOT live in this file (it's
      // committed to git). They're loaded from .env.production on the server
      // via --env-file; create that file from .env.example before first start.
      node_args: ['--env-file=.env.production'],
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
