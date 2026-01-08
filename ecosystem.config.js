module.exports = {
  apps: [{
    name: 'iconify-api-v2',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      PORT: 3000,
      NODE_ENV: 'production',
      MAX_CONCURRENT: 10
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
