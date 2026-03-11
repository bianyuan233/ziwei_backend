// 简单的API测试脚本
const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

console.log('开始测试后端API服务...\n');

// 测试根路径
function testRootEndpoint() {
  console.log('测试根路径 (/)...');
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('状态码:', res.statusCode);
      console.log('响应内容:', data);
      console.log('');
      
      // 继续测试数据API
      testDataEndpoint();
    });
  });

  req.on('error', (e) => {
    console.error('请求错误:', e.message);
  });

  req.end();
}

// 测试数据API
function testDataEndpoint() {
  console.log('测试数据API (/api/data)...');
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/data',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('状态码:', res.statusCode);
      console.log('响应内容:', data);
      console.log('');
      
      console.log('API测试完成！');
    });
  });

  req.on('error', (e) => {
    console.error('请求错误:', e.message);
  });

  req.end();
}

// 开始测试
testRootEndpoint();