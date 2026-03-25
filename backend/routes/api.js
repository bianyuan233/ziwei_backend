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
                name: name,
                month: idx + 1
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

// ==================== 设备管理API ====================

// 模拟设备数据
let devices = [];
let deviceIdCounter = 1;

// 初始化模拟设备数据
function initDevices() {
    devices = [];
    for (let i = 1; i <= 20; i++) {
        devices.push({
            id: i,
            name: i === 1 ? '12345678901234567890' : i === 2 ? '二号厂房12345' : `离心机${String(i).padStart(2, '0')}`,
            type: i % 3 === 0 ? '其他型号' : 'MX30R',
            serialNumber: i === 1 ? '12345678901234567890' : i === 2 ? '12345678' : `SN${String(i).padStart(8, '0')}`,
            ipAddress: i === 1 ? '162.166.166.166' : i === 2 ? '192.168.1.100' : `192.168.1.${100 + i}`,
            speed: 20000,
            time: 20,
            temperature: 4,
            status: i % 5 === 0 ? 'running' : 'offline',
            realtimeSpeed: i % 5 === 0 ? 18000 : (i === 1 ? 9370 : 0),
            realtimeTime: i % 5 === 0 ? 10 : 0,
            realtimeTemp: i % 5 === 0 ? 4 : 20,
            programName: i === 1 ? '这是程序条码名,限定16位字符.' : i === 2 ? '标准程序01' : `程序${String(i).padStart(2, '0')}`,
            settingSpeed: i === 1 ? 10000 : i === 2 ? 15000 : 20000,
            settingTime: i === 1 ? 30 : i === 2 ? 15 : 20,
            settingTemp: i === 1 ? 20 : i === 2 ? 4 : 4,
            accelLevel: i === 2 ? 5 : 9,
            decelLevel: i === 2 ? 5 : 10,
            noBrakeSpeed: i === 2 ? 300 : 500,
            location: i % 2 === 0 ? '二号厂房' : '一号厂房'
        });
    }
    deviceIdCounter = 21;
}

initDevices();

// 获取所有设备
router.get('/devices', (req, res) => {
    res.json({ success: true, data: devices, count: devices.length });
});

// 获取单个设备
router.get('/devices/:id', (req, res) => {
    const device = devices.find(d => d.id === parseInt(req.params.id));
    if (!device) {
        return res.status(404).json({ success: false, message: '设备不存在' });
    }
    res.json({ success: true, data: device });
});

// 搜索设备
router.get('/devices/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: '请提供搜索关键词' });
    const results = devices.filter(d => 
        d.name.includes(q) || d.serialNumber.includes(q) || d.ipAddress.includes(q)
    );
    res.json({ success: true, data: results });
});

// 更新设备状态
router.patch('/devices/:id/status', (req, res) => {
    const device = devices.find(d => d.id === parseInt(req.params.id));
    if (!device) {
        return res.status(404).json({ success: false, message: '设备不存在' });
    }
    const { status, speed, time, temp } = req.body;
    if (status) device.status = status;
    if (speed !== undefined) device.realtimeSpeed = speed;
    if (time !== undefined) device.realtimeTime = time;
    if (temp !== undefined) device.realtimeTemp = temp;
    res.json({ success: true, message: '设备状态更新成功' });
});

// ==================== 通信管理API ====================

let communicationStatus = { active: false, startTime: null };
let communicationInterval = null;

router.get('/communication/status', (req, res) => {
    res.json({
        success: true,
        data: {
            active: communicationStatus.active,
            startTime: communicationStatus.startTime,
            duration: communicationStatus.active && communicationStatus.startTime 
                ? Date.now() - communicationStatus.startTime : 0
        }
    });
});

router.post('/communication/start', (req, res) => {
    if (communicationStatus.active) {
        return res.status(400).json({ success: false, message: '通信已在运行中' });
    }
    communicationStatus.active = true;
    communicationStatus.startTime = Date.now();
    
    // 启动模拟数据更新
    communicationInterval = setInterval(() => {
        if (communicationStatus.active) {
            devices.forEach(device => {
                if (device.status === 'running') {
                    device.realtimeSpeed = Math.max(0, device.realtimeSpeed + Math.floor(Math.random() * 200 - 100));
                    device.realtimeTime += 1;
                }
            });
        }
    }, 5000);
    
    res.json({ success: true, message: '通信已启动' });
});

router.post('/communication/stop', (req, res) => {
    if (!communicationStatus.active) {
        return res.status(400).json({ success: false, message: '通信未运行' });
    }
    communicationStatus.active = false;
    communicationStatus.startTime = null;
    if (communicationInterval) {
        clearInterval(communicationInterval);
        communicationInterval = null;
    }
    res.json({ success: true, message: '通信已停止' });
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
