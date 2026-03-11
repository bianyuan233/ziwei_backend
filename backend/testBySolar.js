const { astro } = require("iztro");
const fs = require('fs');

const birthDate = "1990-05-15";
const timeIndex = 6;
const gender = "男";

console.log("测试 bySolar 接口返回的数据结构...\n");

var astrolabeBySolar = astro.bySolar(birthDate, timeIndex, gender);
console.log("=== bySolar 返回的数据类型 ===");
console.log("类型:", typeof astrolabeBySolar);
console.log("是否为字符串:", typeof astrolabeBySolar === 'string');

if (typeof astrolabeBySolar === 'string') {
    console.log("\n=== bySolar 返回的原始 JSON 字符串 ===");
    console.log(astrolabeBySolar.substring(0, 2000) + "...");
    
    const parsed = JSON.parse(astrolabeBySolar);
    console.log("\n=== 解析后的对象结构 ===");
    console.log("顶层键:", Object.keys(parsed));
}

console.log("\n\n=== 测试 astrolabeBySolarDate 接口 ===");
const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndex, gender, true, "zh-CN");

console.log("星盘对象键:", Object.keys(astrolabe));
console.log("宫位数量:", astrolabe.palaces.length);

console.log("\n=== 测试 horoscope 方法获取大限宫位信息 ===");
const horoscope = astrolabe.horoscope(new Date('1995-06-15'));
console.log("大限索引:", horoscope.decadal.index);
console.log("大限名称:", horoscope.decadal.name);
console.log("大限天干:", horoscope.decadal.heavenlyStem);
console.log("大限地支:", horoscope.decadal.earthlyBranch);
console.log("大限十二宫:", horoscope.decadal.palaceNames);

console.log("\n=== 测试获取每个大限的宫位信息 ===");
const majorPeriodsData = [];
const sortedPalaces = [...astrolabe.palaces].sort((a, b) => {
    const rangeA = a.decadal && a.decadal.range ? a.decadal.range[0] : Infinity;
    const rangeB = b.decadal && b.decadal.range ? b.decadal.range[0] : Infinity;
    return rangeA - rangeB;
});

for (let i = 0; i < 12; i++) {
    const palace = sortedPalaces[i];
    if (palace && palace.decadal) {
        const targetDate = new Date(birthDate.split('-')[0] + palace.decadal.range[0] + 5, 5, 15);
        try {
            const horoscopeData = astrolabe.horoscope(targetDate);
            const palaces = horoscopeData.decadal.palaceNames.map((name, idx) => ({
                index: idx,
                name: name
            }));
            
            majorPeriodsData.push({
                range: palace.decadal.range,
                palaces: palaces
            });
            
            console.log(`\n大限 ${i + 1}: 范围 [${palace.decadal.range.join(', ')}]`);
            console.log("十二宫:", palaces.map(p => p.name).join(', '));
        } catch (e) {
            console.log(`获取大限 ${i + 1} 数据出错:`, e.message);
        }
    }
}

console.log("\n=== 测试获取每个流年的宫位信息 ===");
const yearlyPeriodsData = [];
const birthYear = parseInt(birthDate.split('-')[0]);

for (let i = 0; i < 12; i++) {
    const targetYear = birthYear + i;
    const targetDate = new Date(targetYear, 5, 15);
    
    try {
        const horoscopeData = astrolabe.horoscope(targetDate);
        const palaces = horoscopeData.yearly.palaceNames.map((name, idx) => ({
            index: idx,
            name: name
        }));
        const age = horoscopeData.age.nominalAge;
        
        yearlyPeriodsData.push({
            age: age,
            palaces: palaces
        });
        
        console.log(`\n流年 ${i + 1}: ${targetYear}年, 虚岁 ${age}`);
        console.log("十二宫:", palaces.map(p => p.name).join(', '));
    } catch (e) {
        console.log(`获取流年 ${i + 1} 数据出错:`, e.message);
    }
}

console.log("\n\n=== 完整 JSON 输出 ===");
const result = {
    bySolarData: typeof astrolabeBySolar === 'string' ? JSON.parse(astrolabeBySolar) : astrolabeBySolar,
    majorPeriods: majorPeriodsData,
    yearlyPeriods: yearlyPeriodsData
};

console.log(JSON.stringify(result, null, 2));
