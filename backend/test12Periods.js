const http = require('http');
const fs = require('fs');

function getMajorPeriods(astrolabe) {
    if (!astrolabe || !astrolabe.palaces || !Array.isArray(astrolabe.palaces)) {
        return {
            success: false,
            message: '星盘对象无效或缺少宫位数据',
            count: 0,
            periods: []
        };
    }

    const periods = [];
    const count = Math.min(12, astrolabe.palaces.length);

    for (let i = 0; i < count; i++) {
        const palace = astrolabe.palaces[i];
        
        if (palace && palace.decadal) {
            periods.push({
                sequence: i + 1,
                palaceName: palace.name || `宫位${i + 1}`,
                palaceIndex: palace.index,
                decadalRange: palace.decadal.range || null,
                decadalHeavenlyStem: palace.decadal.heavenlyStem || null,
                decadalEarthlyBranch: palace.decadal.earthlyBranch || null
            });
        }
    }

    periods.sort((a, b) => {
        const rangeA = a.decadalRange ? a.decadalRange[0] : Infinity;
        const rangeB = b.decadalRange ? b.decadalRange[0] : Infinity;
        return rangeA - rangeB;
    });

    periods.forEach((period, index) => {
        period.sequence = index + 1;
    });

    return {
        success: true,
        message: periods.length > 0 ? `成功获取${periods.length}个大限信息` : '未找到大限数据',
        count: periods.length,
        periods: periods
    };
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
            
            console.log('========== 排序后的12个大限信息 ==========');
            console.log('');
            console.log('排序依据: decadalRange 起始年龄升序');
            console.log('');
            
            majorPeriods.periods.forEach((p) => {
                console.log('【第 ' + p.sequence + ' 大限】');
                console.log('  宫位名称: ' + p.palaceName);
                console.log('  宫位索引: ' + p.palaceIndex);
                console.log('  大限范围: [' + p.decadalRange[0] + ', ' + p.decadalRange[1] + ']');
                console.log('  大限干支: ' + p.decadalHeavenlyStem + p.decadalEarthlyBranch);
                console.log('');
            });
            
            console.log('========== 排序验证 ==========');
            const ranges = majorPeriods.periods.map(p => p.decadalRange[0]);
            const isSorted = ranges.every((val, i, arr) => i === 0 || arr[i-1] <= val);
            console.log('起始年龄序列: ' + ranges.join(' -> '));
            console.log('升序验证: ' + (isSorted ? '正确' : '错误'));
            console.log('大限总数: ' + majorPeriods.count);
            
            const logContent = generateLogContent(majorPeriods);
            fs.writeFileSync('/root/czh/backend/testResult0310.log', logContent, { encoding: 'utf8' });
            console.log('\n结果已写入 testResult0310.log');
            
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

function generateLogContent(majorPeriods) {
    const timestamp = new Date().toISOString();
    let content = '';
    content += '============================================================\n';
    content += '测试时间: ' + timestamp + '\n';
    content += '============================================================\n\n';
    content += '【排序后的12个大限信息】\n';
    content += '排序依据: decadalRange 起始年龄升序\n\n';
    
    majorPeriods.periods.forEach((p) => {
        content += '【第 ' + p.sequence + ' 大限】\n';
        content += '  宫位名称: ' + p.palaceName + '\n';
        content += '  宫位索引: ' + p.palaceIndex + '\n';
        content += '  大限范围: [' + p.decadalRange[0] + ', ' + p.decadalRange[1] + ']\n';
        content += '  大限干支: ' + p.decadalHeavenlyStem + p.decadalEarthlyBranch + '\n\n';
    });
    
    content += '============================================================\n';
    content += '【排序验证】\n';
    const ranges = majorPeriods.periods.map(p => p.decadalRange[0]);
    const isSorted = ranges.every((val, i, arr) => i === 0 || arr[i-1] <= val);
    content += '起始年龄序列: ' + ranges.join(' -> ') + '\n';
    content += '升序验证: ' + (isSorted ? '正确' : '错误') + '\n';
    content += '大限总数: ' + majorPeriods.count + '\n';
    
    return content;
}
