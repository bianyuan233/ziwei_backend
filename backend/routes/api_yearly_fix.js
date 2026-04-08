function getYearlyPeriods(astrolabe) {
    if (!astrolabe || !astrolabe.palaces) {
        return [];
    }

    const birthYear = parseInt(astrolabe.solarDate.split('-')[0]);
    const birthLunarMonth = astrolabe.rawDates.lunarDate.lunarMonth;
    const birthTimeBranch = astrolabe.rawDates.chineseDate.hourly[1];
    const earthlyBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const birthTimeIndex = earthlyBranches.indexOf(birthTimeBranch);
    
    const yearlyPeriods = [];

    for (let i = 0; i < 12; i++) {
        const targetYear = birthYear + i;
        const targetDate = new Date(targetYear, 5, 15);
        
        try {
            const horoscopeData = astrolabe.horoscope(targetDate);
            const currentAge = horoscopeData.age.nominalAge;
            const yearlyIndex = horoscopeData.yearly.index;
            
            const firstMonthIndex = ((yearlyIndex - birthLunarMonth + birthTimeIndex + 1) % 12 + 12) % 12;
            
            const palaces = horoscopeData.yearly.palaceNames.map((name, idx) => {
                const month = ((idx - firstMonthIndex + 12) % 12) + 1;
                
                return {
                    index: idx,
                    name: name,
                    month: month
                };
            });
            
            yearlyPeriods.push({
                age: currentAge,
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

module.exports = { getYearlyPeriods };
