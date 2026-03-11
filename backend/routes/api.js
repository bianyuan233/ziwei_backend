const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const execPromise = util.promisify(exec);
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'app.db');

function getDb() {
    return new Database(DB_PATH, { readonly: true });
}

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
    
    return {
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
}

router.get('/db/tables', (req, res) => {
    try {
        const db = getDb();
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        db.close();
        res.json({ code: 200, success: true, data: tables.map(t => t.name) });
    } catch (error) {
        res.status(500).json({ code: 500, success: false, message: error.message });
    }
});

router.get('/db/table/:tableName', (req, res) => {
    try {
        const { tableName } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const db = getDb();
        
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get();
        const total = countResult.count;
        
        const rows = db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`).all(parseInt(limit), offset);
        
        const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
        
        db.close();
        
        res.json({
            code: 200,
            success: true,
            data: {
                columns: columns.map(c => c.name),
                rows: rows,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ code: 500, success: false, message: error.message });
    }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: '服务器运行正常'
  });
});

router.get('/data', dataController.getAllData.bind(dataController));

router.get('/data/:id', dataController.getDataById.bind(dataController));

router.post('/data', dataController.createData.bind(dataController));

router.put('/data/:id', dataController.updateData.bind(dataController));

router.delete('/data/:id', dataController.deleteData.bind(dataController));

router.post('/aiData', async (req, res) => {
  try {
    const { birthDate, timeIndex, gender, occupation } = req.body;
    
    if (!birthDate || timeIndex === undefined || timeIndex === null || timeIndex === '' || !gender) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少必需参数：birthDate(YYYY-MM-DD), timeIndex(0-12), gender(男/女)'
      });
    }
    
    const timeIndexNum = parseInt(timeIndex, 10);
    if (isNaN(timeIndexNum) || timeIndexNum < 0 || timeIndexNum > 12) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'timeIndex 必须是 0-12 之间的整数'
      });
    }
    
    if (gender !== '男' && gender !== '女') {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'gender 必须是 "男" 或 "女"'
      });
    }
    
    const datePattern = /^\d{4}-\d{1,2}-\d{1,2}$/;
    if (!datePattern.test(birthDate)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'birthDate 格式必须为 YYYY-MM-DD'
      });
    }
    
    var iztro = require("iztro");
    var { astro } = require("iztro");
    var astrolabeBySolar = astro.bySolar(birthDate, timeIndexNum, gender);
    const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndexNum, gender, true, "zh-CN");
    
    const bySolarData = getBySolarData(astrolabeBySolar);
    const majorPeriods = getMajorPeriods(astrolabe);
    const yearlyPeriods = getYearlyPeriods(astrolabe);
    
    res.json({
      code: 200,
      success: true,
      data: {
        bySolar: bySolarData,
        majorPeriods: majorPeriods,
        yearlyPeriods: yearlyPeriods
      }
    });
  } catch (error) {
    console.error('Error in /api/aiData:', error);
    res.status(500).json({
      code: 500,
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
