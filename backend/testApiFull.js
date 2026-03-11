const http = require('http');
const fs = require('fs');

console.log('='.repeat(80));
console.log('/api/aiData 接口参数说明及测试');
console.log('='.repeat(80));

console.log('\n【接口参数说明】\n');
console.log('┌─────────────┬──────────┬────────────┬─────────────────────────────────┐');
console.log('│ 参数名称    │ 类型     │ 必填       │ 说明                            │');
console.log('├─────────────┼──────────┼────────────┼─────────────────────────────────┤');
console.log('│ birthDate   │ String   │ 是         │ 出生日期，格式：YYYY-MM-DD      │');
console.log('│             │          │            │ 示例：1990-05-15                │');
console.log('├─────────────┼──────────┼────────────┼─────────────────────────────────┤');
console.log('│ timeIndex   │ Number   │ 是         │ 时辰索引，范围：0-12            │');
console.log('│             │          │            │ 0=早子时, 12=晚子时             │');
console.log('├─────────────┼──────────┼────────────┼─────────────────────────────────┤');
console.log('│ gender      │ String   │ 是         │ 性别，取值："男" 或 "女"        │');
console.log('├─────────────┼──────────┼────────────┼─────────────────────────────────┤');
console.log('│ occupation  │ String   │ 否         │ 职业（可选）                    │');
console.log('└─────────────┴──────────┴────────────┴─────────────────────────────────┘');

console.log('\n【时辰索引对照表】\n');
const timeIndexMap = [
    '0  - 早子时 (23:00-01:00)',
    '1  - 丑时   (01:00-03:00)',
    '2  - 寅时   (03:00-05:00)',
    '3  - 卯时   (05:00-07:00)',
    '4  - 辰时   (07:00-09:00)',
    '5  - 巳时   (09:00-11:00)',
    '6  - 午时   (11:00-13:00)',
    '7  - 未时   (13:00-15:00)',
    '8  - 申时   (15:00-17:00)',
    '9  - 酉时   (17:00-19:00)',
    '10 - 戌时   (19:00-21:00)',
    '11 - 亥时   (21:00-23:00)',
    '12 - 晚子时 (23:00-01:00)'
];
timeIndexMap.forEach(t => console.log(`  ${t}`));

const testCases = [
    { name: '正常用例-男性', data: { birthDate: '1990-05-15', timeIndex: 6, gender: '男' }, expectSuccess: true },
    { name: '正常用例-女性', data: { birthDate: '1985-12-25', timeIndex: 0, gender: '女' }, expectSuccess: true },
    { name: '正常用例-带职业', data: { birthDate: '2000-01-01', timeIndex: 12, gender: '男', occupation: '工程师' }, expectSuccess: true },
    { name: '边界用例-最早年份', data: { birthDate: '1900-01-01', timeIndex: 0, gender: '男' }, expectSuccess: true },
    { name: '边界用例-最晚年份', data: { birthDate: '2024-12-31', timeIndex: 12, gender: '女' }, expectSuccess: true },
    { name: '边界用例-timeIndex=0', data: { birthDate: '1990-05-15', timeIndex: 0, gender: '男' }, expectSuccess: true },
    { name: '边界用例-timeIndex=12', data: { birthDate: '1990-05-15', timeIndex: 12, gender: '男' }, expectSuccess: true },
    { name: '错误用例-缺少birthDate', data: { timeIndex: 6, gender: '男' }, expectSuccess: false },
    { name: '错误用例-缺少timeIndex', data: { birthDate: '1990-05-15', gender: '男' }, expectSuccess: false },
    { name: '错误用例-缺少gender', data: { birthDate: '1990-05-15', timeIndex: 6 }, expectSuccess: false },
    { name: '错误用例-timeIndex超出范围', data: { birthDate: '1990-05-15', timeIndex: 13, gender: '男' }, expectSuccess: false },
    { name: '错误用例-timeIndex负数', data: { birthDate: '1990-05-15', timeIndex: -1, gender: '男' }, expectSuccess: false },
    { name: '错误用例-gender错误值', data: { birthDate: '1990-05-15', timeIndex: 6, gender: 'male' }, expectSuccess: false },
    { name: '错误用例-birthDate格式错误', data: { birthDate: '1990/05/15', timeIndex: 6, gender: '男' }, expectSuccess: false },
    { name: '错误用例-birthDate格式错误2', data: { birthDate: '1990-5-15', timeIndex: 6, gender: '男' }, expectSuccess: true },
    { name: '错误用例-空对象', data: {}, expectSuccess: false },
];

console.log('\n' + '='.repeat(80));
console.log('开始测试');
console.log('='.repeat(80));

function makeRequest(testData) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(testData);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/aiData',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data, parseError: true });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ error: e.message });
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    const results = [];
    let passCount = 0;
    let failCount = 0;

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n【测试 ${i + 1}/${testCases.length}】${testCase.name}`);
        console.log(`请求参数: ${JSON.stringify(testCase.data)}`);

        const result = await makeRequest(testCase.data);
        
        let status = '';
        let passed = false;

        if (result.error) {
            status = `❌ 请求失败: ${result.error}`;
            passed = false;
        } else if (result.parseError) {
            status = `❌ 响应解析失败`;
            passed = false;
        } else {
            const isSuccess = result.body.success === true;
            if (testCase.expectSuccess === isSuccess) {
                status = `✅ 测试通过 (HTTP ${result.statusCode})`;
                passed = true;
            } else {
                status = `❌ 测试失败 - 期望${testCase.expectSuccess ? '成功' : '失败'}，实际${isSuccess ? '成功' : '失败'}`;
                passed = false;
            }

            if (isSuccess && testCase.expectSuccess) {
                const data = result.body.data;
                console.log(`   响应数据摘要:`);
                console.log(`   - bySolar.solarDate: ${data.bySolar?.solarDate}`);
                console.log(`   - bySolar.zodiac: ${data.bySolar?.zodiac}`);
                console.log(`   - bySolar.fiveElementsClass: ${data.bySolar?.fiveElementsClass}`);
                console.log(`   - majorPeriods 数量: ${data.majorPeriods?.length}`);
                console.log(`   - yearlyPeriods 数量: ${data.yearlyPeriods?.length}`);
            } else {
                console.log(`   错误信息: ${result.body.message || JSON.stringify(result.body)}`);
            }
        }

        console.log(status);
        
        if (passed) passCount++;
        else failCount++;

        results.push({
            name: testCase.name,
            data: testCase.data,
            expectSuccess: testCase.expectSuccess,
            actualSuccess: result.body?.success,
            statusCode: result.statusCode,
            message: result.body?.message,
            passed: passed
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('测试结果汇总');
    console.log('='.repeat(80));
    console.log(`总计: ${testCases.length} 个测试`);
    console.log(`通过: ${passCount} 个 ✅`);
    console.log(`失败: ${failCount} 个 ❌`);

    const logContent = `/api/aiData 接口测试报告\n` +
        `测试时间: ${new Date().toISOString()}\n` +
        '='.repeat(80) + '\n\n' +
        '【接口参数说明】\n' +
        'birthDate: String, 必填, 格式 YYYY-MM-DD\n' +
        'timeIndex: Number, 必填, 范围 0-12\n' +
        'gender: String, 必填, 取值 "男" 或 "女"\n' +
        'occupation: String, 可选\n\n' +
        '【测试结果汇总】\n' +
        `总计: ${testCases.length} 个测试\n` +
        `通过: ${passCount} 个\n` +
        `失败: ${failCount} 个\n\n` +
        '【详细测试结果】\n' +
        JSON.stringify(results, null, 2);

    fs.writeFileSync('testResult0310.log', logContent, 'utf8');
    console.log('\n测试结果已保存到 testResult0310.log');
}

runTests();
