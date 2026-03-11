const { astro } = require("iztro");
const fs = require('fs');

const birthDate = "1990-05-15";
const timeIndex = 6;
const gender = "男";

console.log("测试优化后的 API 响应格式...\n");

var astrolabeBySolar = astro.bySolar(birthDate, timeIndex, gender);
const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndex, gender, true, "zh-CN");

function getMajorPeriods(astrolabe) {
    if (!astrolabe || !astrolabe.palaces || !Array.isArray(astrolabe.palaces)) {
        return [];
    }

    const periods = [];
    const sortedPalaces = [...astrolabe.palaces].sort((a, b) => {
        const rangeA = a.decadal && a.decadal.range ? a.decadal.range[0] : Infinity;
        const rangeB = b.decadal && b.decadal.range ? b.decadal.range[0] : Infinity;
        return rangeA - rangeB;
    });

    for (let i = 0; i < 12; i++) {
        const palace = sortedPalaces[i];
        if (palace && palace.decadal) {
            const range = palace.decadal.range;
            const midAge = Math.floor((range[0] + range[1]) / 2);
            const birthYear = parseInt(astrolabe.solarDate.split('-')[0]);
            const targetYear = birthYear + midAge;
            const targetDate = new Date(targetYear, 5, 15);
            
            try {
                const horoscopeData = astrolabe.horoscope(targetDate);
                const palaces = horoscopeData.decadal.palaceNames.map((name, idx) => ({
                    index: idx,
                    name: name
                }));
                
                periods.push({
                    range: range,
                    palaces: palaces
                });
            } catch (e) {
                const palaceIndex = palace.index;
                const palaceNames = [];
                for (let j = 0; j < 12; j++) {
                    const targetIdx = (palaceIndex + j) % 12;
                    palaceNames.push({
                        index: j,
                        name: astrolabe.palaces[targetIdx].name
                    });
                }
                periods.push({
                    range: range,
                    palaces: palaceNames
                });
            }
        }
    }

    return periods;
}

function getYearlyPeriods(astrolabe) {
    if (!astrolabe || !astrolabe.palaces) {
        return [];
    }

    const birthYear = parseInt(astrolabe.solarDate.split('-')[0]);
    const yearlyPeriods = [];

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
            
            yearlyPeriods.push({
                age: age,
                palaces: palaces
            });
        } catch (e) {
            yearlyPeriods.push({
                age: i + 1,
                palaces: []
            });
        }
    }

    return yearlyPeriods;
}

function getBySolarData(astrolabeBySolar) {
    if (!astrolabeBySolar) {
        return null;
    }
    
    const data = {
        gender: astrolabeBySolar.gender,
        solarDate: astrolabeBySolar.solarDate,
        lunarDate: astrolabeBySolar.lunarDate,
        chineseDate: astrolabeBySolar.chineseDate,
        rawDates: astrolabeBySolar.rawDates,
        time: astrolabeBySolar.time,
        timeRange: astrolabeBySolar.timeRange,
        sign: astrolabeBySolar.sign,
        zodiac: astrolabeBySolar.zodiac,
        earthlyBranchOfSoulPalace: astrolabeBySolar.earthlyBranchOfSoulPalace,
        earthlyBranchOfBodyPalace: astrolabeBySolar.earthlyBranchOfBodyPalace,
        soul: astrolabeBySolar.soul,
        body: astrolabeBySolar.body,
        fiveElementsClass: astrolabeBySolar.fiveElementsClass,
        palaces: astrolabeBySolar.palaces.map(p => ({
            index: p.index,
            name: p.name,
            heavenlyStem: p.heavenlyStem,
            earthlyBranch: p.earthlyBranch,
            isBodyPalace: p.isBodyPalace,
            isOriginalPalace: p.isOriginalPalace,
            majorStars: p.majorStars.map(s => ({
                name: s.name,
                type: s.type,
                brightness: s.brightness,
                mutagen: s.mutagen
            })),
            minorStars: p.minorStars.map(s => ({
                name: s.name,
                type: s.type,
                brightness: s.brightness,
                mutagen: s.mutagen
            })),
            adjectiveStars: p.adjectiveStars.map(s => ({
                name: s.name,
                type: s.type
            })),
            changsheng12: p.changsheng12,
            boshi12: p.boshi12,
            jiangqian12: p.jiangqian12,
            suiqian12: p.suiqian12,
            decadal: p.decadal,
            ages: p.ages
        }))
    };
    
    return data;
}

const bySolarData = getBySolarData(astrolabeBySolar);
const majorPeriods = getMajorPeriods(astrolabe);
const yearlyPeriods = getYearlyPeriods(astrolabe);

console.log("=== bySolar 完整数据 ===");
console.log("性别:", bySolarData.gender);
console.log("阳历日期:", bySolarData.solarDate);
console.log("农历日期:", bySolarData.lunarDate);
console.log("干支日期:", bySolarData.chineseDate);
console.log("时辰:", bySolarData.time);
console.log("星座:", bySolarData.sign);
console.log("生肖:", bySolarData.zodiac);
console.log("五行局:", bySolarData.fiveElementsClass);
console.log("宫位数量:", bySolarData.palaces.length);

console.log("\n=== 12个大限信息（按时间排序）===");
majorPeriods.forEach((p, i) => {
    console.log(`${i + 1}. 范围 [${p.range.join(', ')}]`);
    console.log(`   十二宫: ${p.palaces.map(pl => pl.name).join(', ')}`);
});

console.log("\n=== 12个流年信息（按时间排序）===");
yearlyPeriods.forEach((p, i) => {
    console.log(`${i + 1}. 虚岁 ${p.age}`);
    console.log(`   十二宫: ${p.palaces.map(pl => pl.name).join(', ')}`);
});

const result = {
    code: 200,
    success: true,
    data: {
        bySolar: bySolarData,
        majorPeriods: majorPeriods,
        yearlyPeriods: yearlyPeriods
    }
};

const logContent = `API 测试结果 - ${new Date().toISOString()}\n` +
    '='.repeat(80) + '\n\n' +
    '【请求参数】\n' +
    `birthDate: ${birthDate}\n` +
    `timeIndex: ${timeIndex}\n` +
    `gender: ${gender}\n\n` +
    '【完整 JSON 响应】\n' +
    JSON.stringify(result, null, 2);

fs.writeFileSync('testResult0310.log', logContent, 'utf8');
console.log('\n\n测试结果已保存到 testResult0310.log');
