const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 根路径 - 显示离心机监控系统
app.get('/', (req, res) => {
    const centrifugePath = path.join(__dirname, 'public/index.html');
    if (fs.existsSync(centrifugePath)) {
        res.sendFile(centrifugePath);
    } else {
        res.json({
            message: '离心机监控系统页面未找到',
            timestamp: new Date().toISOString()
        });
    }
});

// /ziweibackend 路径 - 显示原始CentriLog_schema页面
app.get('/ziweibackend', (req, res) => {
    const htmlPath = path.join(__dirname, 'CentriLog_schema.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.json({
            message: 'CentriLog页面未找到',
            timestamp: new Date().toISOString()
        });
    }
});

// /ziweibackend/ 也指向同一页面
app.get('/ziweibackend/', (req, res) => {
    const htmlPath = path.join(__dirname, 'CentriLog_schema.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.json({
            message: 'CentriLog页面未找到',
            timestamp: new Date().toISOString()
        });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// 小程序API路由
app.use('/api', require('./routes/api'));

// 离心机监控API路由
app.use('/api', require('./routes/centrifuge'));

// AI 流式问答路由
app.use('/api/agent', require('./routes/agent'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 或 http://0.0.0.0:${PORT} 查看服务状态`);
});

module.exports = app;