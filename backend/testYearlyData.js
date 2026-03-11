const { astro } = require("iztro");
const fs = require('fs');

const birthDate = "1990-05-15";
const timeIndex = 6;
const gender = "男";

console.log("测试获取流年数据...\n");

const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndex, gender, true, "zh-CN");

console.log("=== 星盘基本信息 ===");
console.log("阳历日期:", astrolabe.solarDate);
console.log("农历日期:", astrolabe.lunarDate);
console.log("干支日期:", astrolabe.chineseDate);
console.log("生肖:", astrolabe.zodiac);
console.log("五行局:", astrolabe.fiveElementsClass);

console.log("\n=== 测试 horoscope 方法 ===");
const horoscope = astrolabe.horoscope(new Date());
console.log("流年信息:", JSON.stringify(horoscope.yearly, null, 2));

console.log("\n=== 获取12个流年的宫位信息 ===");
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
            earthlyBranch: horoscopeData.yearly.earthlyBranch,
            palaceIndex: yearlyIndex
        });
    } catch (e) {
        console.log(`获取 ${targetYear} 年流年数据出错:`, e.message);
    }
}

console.log("\n12个流年宫位信息:");
yearlyPeriods.forEach((p, i) => {
    console.log(`${i + 1}. ${p.year}年 - ${p.palaceName} (${p.heavenlyStem}${p.earthlyBranch})`);
});

console.log("\n=== 完整星盘结构 ===");
const astrolabeData = {
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
        majorStars: p.majorStars.map(s => ({ name: s.name, type: s.type, brightness: s.brightness })),
        minorStars: p.minorStars.map(s => ({ name: s.name, type: s.type, brightness: s.brightness })),
        adjectiveStars: p.adjectiveStars.map(s => ({ name: s.name, type: s.type })),
        changsheng12: p.changsheng12,
        boshi12: p.boshi12,
        decadal: p.decadal,
        ages: p.ages
    }))
};

console.log(JSON.stringify(astrolabeData, null, 2));
