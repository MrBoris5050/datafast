module.exports = {
  apps: [
    {
      name: 'datafast',
      script: 'node_modules/.bin/next',
      args: 'start --port 3011',
      cwd: '/var/www/datafast',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3011,
        HOSTNAME: '127.0.0.1',
      },
      error_file: '/var/log/pm2/datafast-error.log',
      out_file: '/var/log/pm2/datafast-out.log',
      time: true,
    },
    {
      name: 'datafast-webhook',
      script: 'scripts/webhook-server.js',
      cwd: '/var/www/datafast',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 9011,
      },
      error_file: '/var/log/pm2/datafast-webhook-error.log',
      out_file: '/var/log/pm2/datafast-webhook-out.log',
      time: true,
    },
  ],
}
