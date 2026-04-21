module.exports = {
  apps: [
    {
      name: 'miniprogram-backend',
      script: './server.js',
      cwd: '/home/ubuntu/backend_260314/ziwei_backend/backend',
      interpreter: '/home/ubuntu/runtime/node-v18.17.1/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        POKEMON_AGENT_BASE_URL: 'http://127.0.0.1:8000',
        POKEMON_AGENT_TIMEOUT: 120000,
        NODE_OPTIONS: '--dns-result-order=ipv4first'
      }
    },
    {
      name: 'ziwei-python-agent',
      script: '/home/ubuntu/ziwei_agent/env/ziwei/bin/python',
      args: 'app.py',
      cwd: '/home/ubuntu/ziwei_agent/workspace',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1'
      }
    }
  ]
};
