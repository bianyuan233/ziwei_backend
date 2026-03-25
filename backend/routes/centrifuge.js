const express = require('express');
const router = express.Router();

// 模拟设备数据
let devices = [];

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
}

initDevices();

// 通信状态
let communicationStatus = { active: false, startTime: null };
let communicationInterval = null;

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

// 通信状态
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

// 启动通信
router.post('/communication/start', (req, res) => {
    if (communicationStatus.active) {
        return res.status(400).json({ success: false, message: '通信已在运行中' });
    }
    communicationStatus.active = true;
    communicationStatus.startTime = Date.now();
    
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

// 停止通信
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

module.exports = router;
