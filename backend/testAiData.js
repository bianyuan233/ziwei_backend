const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    host: 'localhost',
    port: 3000,
    endpoint: '/api/aiData',
    logFile: path.join(__dirname, 'testResult0310.log')
};

const TEST_DATA = {
    birthDate: '1990-05-15',
    timeIndex: 6,
    gender: '男',
    occupation: '软件工程师'
};

function writeLog(content) {
    const timestamp = new Date().toISOString();
    const header = `\n${'='.repeat(60)}\n测试时间: ${timestamp}\n${'='.repeat(60)}\n`;
    const fullContent = header + content + '\n';
    
    fs.writeFileSync(CONFIG.logFile, fullContent, { encoding: 'utf8', flag: 'w' });
    console.log(`日志已写入: ${CONFIG.logFile}`);
}

function formatJson(data, indent = 2) {
    try {
        return JSON.stringify(data, null, indent);
    } catch (error) {
        return `[JSON格式化失败: ${error.message}]`;
    }
}

function testAiDataApi() {
    console.log('开始测试 /api/aiData 接口...');
    console.log(`请求地址: http://${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}`);
    console.log(`请求参数: ${formatJson(TEST_DATA)}`);
    console.log('');

    const requestBody = JSON.stringify(TEST_DATA);

    const options = {
        hostname: CONFIG.host,
        port: CONFIG.port,
        path: CONFIG.endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
            'Accept': 'application/json',
            'User-Agent': 'Node.js Test Client'
        }
    };

    const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
            responseData += chunk;
        });

        res.on('end', () => {
            console.log(`响应状态码: ${res.statusCode}`);
            console.log(`响应头: ${formatJson(res.headers)}`);
            console.log('');

            let parsedData;
            let logContent = '';

            try {
                parsedData = JSON.parse(responseData);
                console.log('JSON解析成功');
                
                logContent += '【请求信息】\n';
                logContent += `请求URL: http://${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}\n`;
                logContent += `请求方法: POST\n`;
                logContent += `请求头: ${formatJson(options.headers)}\n`;
                logContent += `请求体: ${formatJson(TEST_DATA)}\n\n`;
                
                logContent += '【响应信息】\n';
                logContent += `HTTP状态码: ${res.statusCode}\n`;
                logContent += `响应头: ${formatJson(res.headers)}\n\n`;
                
                logContent += '【响应数据】\n';
                logContent += formatJson(parsedData, 2);

                if (res.statusCode === 200 && parsedData.success) {
                    console.log('\n接口调用成功!');
                    
                    if (parsedData.data) {
                        console.log('\n--- 数据摘要 ---');
                        if (parsedData.data.palace) {
                            console.log(`命宫名称: ${parsedData.data.palace.name}`);
                            console.log(`大限范围: ${JSON.stringify(parsedData.data.palace.decadal?.range)}`);
                        }
                        if (parsedData.data.majorPeriods) {
                            console.log(`大限数量: ${parsedData.data.majorPeriods.count}`);
                            console.log(`大限信息: ${parsedData.data.majorPeriods.message}`);
                        }
                    }
                } else {
                    console.log('\n接口返回错误:');
                    console.log(`消息: ${parsedData.message || '未知错误'}`);
                }

            } catch (parseError) {
                console.error('JSON解析失败:', parseError.message);
                
                logContent += '【请求信息】\n';
                logContent += `请求URL: http://${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}\n`;
                logContent += `请求方法: POST\n`;
                logContent += `请求体: ${formatJson(TEST_DATA)}\n\n`;
                
                logContent += '【响应信息】\n';
                logContent += `HTTP状态码: ${res.statusCode}\n\n`;
                
                logContent += '【原始响应数据】\n';
                logContent += responseData;

                parsedData = { 
                    error: 'JSON解析失败', 
                    message: parseError.message,
                    rawResponse: responseData 
                };
            }

            try {
                writeLog(logContent);
                console.log('\n测试完成，结果已保存到 testResult0310.log');
            } catch (writeError) {
                console.error('写入日志文件失败:', writeError.message);
            }
        });
    });

    req.on('error', (error) => {
        console.error('请求发生错误:', error.message);
        
        const errorLog = `【请求错误】\n` +
            `请求URL: http://${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}\n` +
            `请求体: ${formatJson(TEST_DATA)}\n\n` +
            `错误类型: ${error.code || 'UNKNOWN'}\n` +
            `错误信息: ${error.message}\n` +
            `错误堆栈: ${error.stack}`;
        
        try {
            writeLog(errorLog);
        } catch (writeError) {
            console.error('写入错误日志失败:', writeError.message);
        }

        if (error.code === 'ECONNREFUSED') {
            console.error('\n无法连接到服务器，请确认服务器是否已启动。');
            console.error('启动命令: cd /root/czh/backend && node server.js');
        }
    });

    req.setTimeout(30000, () => {
        console.error('请求超时（30秒）');
        req.destroy();
        
        const timeoutLog = `【请求超时】\n` +
            `请求URL: http://${CONFIG.host}:${CONFIG.port}${CONFIG.endpoint}\n` +
            `请求体: ${formatJson(TEST_DATA)}\n\n` +
            `超时时间: 30秒`;
        
        try {
            writeLog(timeoutLog);
        } catch (writeError) {
            console.error('写入超时日志失败:', writeError.message);
        }
    });

    req.write(requestBody);
    req.end();
}

function main() {
    console.log('========================================');
    console.log('   /api/aiData 接口测试程序');
    console.log('========================================');
    console.log('');
    
    testAiDataApi();
}

main();
