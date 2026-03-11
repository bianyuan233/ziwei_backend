const http = require('http');
const fs = require('fs');

function getMajorPeriods(astrolabe) {
    if (!astrolabe || !astrolabe.palaces || !Array.isArray(astrolabe.palaces)) {
        return [];
    }

    const periods = [];
    const count = Math.min(12, astrolabe.palaces.length);

    for (let i = 0; i < count; i++) {
        const palace = astrolabe.palaces[i];
        
        if (palace && palace.decadal) {
            periods.push({
                palaceName: palace.name || `宫位${i + 1}`,
                decadalRange: palace.decadal.range || null
            });
        }
    }

    periods.sort((a, b) => {
        const rangeA = a.decadalRange ? a.decadalRange[0] : Infinity;
        const rangeB = b.decadalRange ? b.decadalRange[0] : Infinity;
        return rangeA - rangeB;
    });

    return periods;
}

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/aiData',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

const requestBody = JSON.stringify({
    birthDate: '1990-05-15',
    timeIndex: 6,
    gender: '男'
});

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);
            const content = JSON.parse(jsonData.data.content);
            
            const majorPeriods = getMajorPeriods(content);
            
            let logContent = '';
            const timestamp = new Date().toISOString();
            
            logContent += '============================================================\n';
            logContent += '测试时间: ' + timestamp + '\n';
            logContent += '============================================================\n\n';
            
            logContent += '【请求参数】\n';
            logContent += 'birthDate: 1990-05-15\n';
            logContent += 'timeIndex: 6\n';
            logContent += 'gender: 男\n\n';
            
            logContent += '【接口响应状态】\n';
            logContent += 'HTTP状态码: ' + res.statusCode + '\n';
            logContent += 'success: ' + jsonData.success + '\n\n';
            
            logContent += '【12个大限数据（按年龄升序排列）】\n';
            logContent += '每个大限仅包含: 宫位名称、大限范围\n\n';
            
            majorPeriods.forEach((p, index) => {
                logContent += '第 ' + (index + 1) + ' 大限:\n';
                logContent += '  宫位名称: ' + p.palaceName + '\n';
                logContent += '  大限范围: [' + p.decadalRange[0] + ', ' + p.decadalRange[1] + ']\n\n';
            });
            
            logContent += '============================================================\n';
            logContent += '【排序验证】\n';
            const ranges = majorPeriods.map(p => p.decadalRange[0]);
            const isSorted = ranges.every((val, i, arr) => i === 0 || arr[i-1] <= val);
            logContent += '起始年龄序列: ' + ranges.join(' -> ') + '\n';
            logContent += '升序验证: ' + (isSorted ? '正确' : '错误') + '\n';
            logContent += '大限总数: ' + majorPeriods.length + '\n\n';
            
            logContent += '【JSON格式输出】\n';
            logContent += JSON.stringify(majorPeriods, null, 2) + '\n';
            
            fs.writeFileSync('/root/czh/backend/testResult0310.log', logContent, { encoding: 'utf8' });
            
            console.log('========== 测试结果 ==========');
            console.log('');
            console.log('大限总数:', majorPeriods.length);
            console.log('排序验证:', isSorted ? '正确' : '错误');
            console.log('');
            console.log('【12个大限数据】');
            majorPeriods.forEach((p, index) => {
                console.log('第 ' + (index + 1) + ' 大限: ' + p.palaceName + ' [' + p.decadalRange[0] + ', ' + p.decadalRange[1] + ']');
            });
            console.log('');
            console.log('结果已写入 testResult0310.log');
            
        } catch (error) {
            console.error('解析错误:', error.message);
        }
    });
});

req.on('error', (error) => {
    console.error('请求错误:', error.message);
});

req.write(requestBody);
req.end();
