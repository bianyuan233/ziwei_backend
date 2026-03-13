module.exports = {
  apps: [{
    name: 'miniprogram-backend',
    script: './server.js',
    cwd: '/home/ubuntu/backend_260314/ziwei_backend/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    }
  }]
};
