module.exports = {
  apps: [
    {
      name: 'smart-wing-voucher-test',
      cwd: '/opt/smart-wing-voucher-test/current',
      script: '/opt/smart-wing/node_modules/vite/bin/vite.js',
      args: 'preview --config ./vite.preview-mall-test.config.mjs --host 127.0.0.1 --port 3011 --strictPort',
      interpreter: '/usr/bin/node',
      env: { NODE_ENV: 'production' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '/var/log/pm2/smart-wing-voucher-test-error.log',
      out_file: '/var/log/pm2/smart-wing-voucher-test-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
