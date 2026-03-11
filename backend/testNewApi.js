const { astro } = require("iztro");
const fs = require('fs');

const birthDate = "1990-05-15";
const timeIndex = 6;
const gender = "男";

console.log("测试优化后的 API 响应格式...\n");

const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndex, gender, true, "zh-CN");

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

function getYearlyPeriods(astrolabe, birthDate) {
    if (!astrolabe || !astrolabe.palaces) {
        return [];
    }
    const birthYear = parseInt(birthDate.split('-')[0]);
    const yearlyPeriods = [];
    for (let i = 0; i < 12; i++) {
        const targetYear = birthYear + i;
        const targetDate = new Date(targetYear, 5, 15);
        try {
            const horoscopeData = astrolabe.horoscope(targetDate);
            const yearlyIndex = horoscopeData.yearly.index;
            const palace = astrolabe.palaces[yearlyIndex];
            yearlyPeriods.push({
                year: targetYear,
                palaceName: palace ? palace.name : null,
                heavenlyStem: horoscopeData.yearly.heavenlyStem,
                earthlyBranch: horoscopeData.yearly.earthlyBranch
            });
        } catch (e) {
            yearlyPeriods.push({
                year: targetYear,
                palaceName: null,
                heavenlyStem: null,
                earthlyBranch: null
            });
        }
    }
    return yearlyPeriods;
}

function getAstrolabeData(astrolabe) {
    if (!astrolabe) return null;
    return {
        gender: astrolabe.gender,
        solarDate: astrolabe.solarDate,
        lunarDate: astrolabe.lunarDate,
        chineseDate: astrolabe.chineseDate,
        time: astrolabe.time,
        timeRange: astrolabe.timeRange,
        sign: astrolabe.sign,
        zodiac: astrolabe.zodiac,
        earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace,
        earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace,
        soul: astrolabe.soul,
        body: astrolabe.body,
        fiveElementsClass: astrolabe.fiveElementsClass,
        palaces: astrolabe.palaces.map(p => ({
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
}

const astrolabeData = getAstrolabeData(astrolabe);
const majorPeriods = getMajorPeriods(astrolabe);
const yearlyPeriods = getYearlyPeriods(astrolabe, birthDate);

console.log("=== 完整命盘结构体 ===");
console.log("性别:", astrolabeData.gender);
console.log("阳历日期:", astrolabeData.solarDate);
console.log("农历日期:", astrolabeData.lunarDate);
console.log("干支日期:", astrolabeData.chineseDate);
console.log("时辰:", astrolabeData.time);
console.log("时辰范围:", astrolabeData.timeRange);
console.log("星座:", astrolabeData.sign);
console.log("生肖:", astrolabeData.zodiac);
console.log("命宫地支:", astrolabeData.earthlyBranchOfSoulPalace);
console.log("身宫地支:", astrolabeData.earthlyBranchOfBodyPalace);
console.log("命主:", astrolabeData.soul);
console.log("身主:", astrolabeData.body);
console.log("五行局:", astrolabeData.fiveElementsClass);
console.log("宫位数量:", astrolabeData.palaces.length);

console.log("\n=== 12个大限信息（按时间排序）===");
majorPeriods.forEach((p, i) => {
    console.log(`${i + 1}. ${p.palaceName}: [${p.decadalRange.join(', ')}]`);
});

console.log("\n=== 12个流年宫位信息（按时间排序）===");
yearlyPeriods.forEach((p, i) => {
    console.log(`${i + 1}. ${p.year}年 - ${p.palaceName} (${p.heavenlyStem}${p.earthlyBranch})`);
});

const result = {
    code: 200,
    success: true,
    data: {
        astrolabe: astrolabeData,
        majorPeriods: majorPeriods,
        yearlyPeriods: yearlyPeriods,
        occupation: null,
        id: "iztro_" + Date.now(),
        timestamp: Date.now()
    }
};

const logContent = `API 测试结果 - ${new Date().toISOString()}\n` +
    '='.repeat(80) + '\n\n' +
    '【请求参数】\n' +
    `birthDate: ${birthDate}\n` +
    `timeIndex: ${timeIndex}\n` +
    `gender: ${gender}\n\n` +
    '【响应状态】\n' +
    `code: ${result.code}\n` +
    `success: ${result.success}\n\n` +
    '【完整命盘结构体】\n' +
    `性别: ${astrolabeData.gender}\n` +
    `阳历日期: ${astrolabeData.solarDate}\n` +
    `农历日期: ${astrolabeData.lunarDate}\n` +
    `干支日期: ${astrolabeData.chineseDate}\n` +
    `时辰: ${astrolabeData.time}\n` +
    `时辰范围: ${astrolabeData.timeRange}\n` +
    `星座: ${astrolabeData.sign}\n` +
    `生肖: ${astrolabeData.zodiac}\n` +
    `命宫地支: ${astrolabeData.earthlyBranchOfSoulPalace}\n` +
    `身宫地支: ${astrolabeData.earthlyBranchOfBodyPalace}\n` +
    `命主: ${astrolabeData.soul}\n` +
    `身主: ${astrolabeData.body}\n` +
    `五行局: ${astrolabeData.fiveElementsClass}\n` +
    `宫位数量: ${astrolabeData.palaces.length}\n\n` +
    '【12个大限信息（按时间排序）】\n' +
    majorPeriods.map((p, i) => `${i + 1}. ${p.palaceName}: [${p.decadalRange.join(', ')}]`).join('\n') + '\n\n' +
    '【12个流年宫位信息（按时间排序）】\n' +
    yearlyPeriods.map((p, i) => `${i + 1}. ${p.year}年 - ${p.palaceName} (${p.heavenlyStem}${p.earthlyBranch})`).join('\n') + '\n\n' +
    '【完整JSON响应】\n' +
    JSON.stringify(result, null, 2);

fs.writeFileSync('testResult0310.log', logContent, 'utf8');
console.log('\n\n测试结果已保存到 testResult0310.log');
