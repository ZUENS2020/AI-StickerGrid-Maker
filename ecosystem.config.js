module.exports = {
  apps: [
    {
      name: 'stickergrid-app',
      script: 'server/index.js',
      interpreter: 'node',
      cwd: 'C:\\Users\\22595\\Desktop\\SERVER\\AI-StickerGrid-Maker',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
