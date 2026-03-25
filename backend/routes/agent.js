const express = require('express');
const router = express.Router();
const { pokemonAgentClient, PokemonAgentError } = require('../services/pokemonAgentService');
const { v4: uuidv4 } = require('uuid');

const iztro = require("iztro");
const { astro } = require("iztro");

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

function validateAiDataParams(birthDate, timeIndex, gender) {
    if (!birthDate || timeIndex === undefined || timeIndex === null || timeIndex === '' || !gender) {
        return {
            valid: false,
            message: '缺少必需参数：birthDate(YYYY-MM-DD), timeIndex(0-12), gender(男/女)'
        };
    }
    
    const timeIndexNum = parseInt(timeIndex, 10);
    if (isNaN(timeIndexNum) || timeIndexNum < 0 || timeIndexNum > 12) {
        return {
            valid: false,
            message: 'timeIndex 必须是 0-12 之间的整数'
        };
    }
    
    if (gender !== '男' && gender !== '女') {
        return {
            valid: false,
            message: 'gender 必须是 "男" 或 "女"'
        };
    }
    
    const datePattern = /^\d{4}-\d{1,2}-\d{1,2}$/;
    if (!datePattern.test(birthDate)) {
        return {
            valid: false,
            message: 'birthDate 格式必须为 YYYY-MM-DD'
        };
    }
    
    return { valid: true, timeIndexNum };
}

function getAiDataInternal(birthDate, timeIndexNum, gender) {
    const astrolabeBySolar = astro.bySolar(birthDate, timeIndexNum, gender);
    const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndexNum, gender, true, "zh-CN");
    
    const bySolarData = getBySolarData(astrolabeBySolar);
    const majorPeriods = getMajorPeriods(astrolabe);
    const yearlyPeriods = getYearlyPeriods(astrolabe);
    
    return {
        bySolar: bySolarData,
        majorPeriods: majorPeriods,
        yearlyPeriods: yearlyPeriods
    };
}

router.post('/stream', async (req, res) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
        const { birthDate, timeIndex, gender, occupation, userId, sessionId, customPrompt } = req.body;
        
        const validation = validateAiDataParams(birthDate, timeIndex, gender);
        if (!validation.valid) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: validation.message,
                requestId
            });
        }
        
        const aiDataOutput = getAiDataInternal(birthDate, validation.timeIndexNum, gender);
        
        const agentInput = pokemonAgentClient.transformAiDataToAgentInput(
            aiDataOutput,
            userId || `user_${Date.now()}`,
            sessionId || `session_${Date.now()}`
        );
        
        if (customPrompt) {
            agentInput.message = customPrompt;
        }
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Request-Id', requestId);
        res.setHeader('X-AiData-Process-Time', Date.now() - startTime);
        
        res.write(`data: ${JSON.stringify({
            type: 'metadata',
            requestId,
            aiDataProcessTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        })}\n\n`);
        
        const streamGenerator = await pokemonAgentClient.streamChatWithRetry(agentInput, {
            requestId,
            timeout: 120000
        });
        
        for await (const chunk of streamGenerator) {
            if (chunk.type === 'chunk' || chunk.type === 'raw') {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            } else if (chunk.type === 'done') {
                res.write(`data: ${JSON.stringify({
                    ...chunk,
                    totalTime: Date.now() - startTime
                })}\n\n`);
            }
        }
        
        res.end();
        
    } catch (error) {
        console.error('Stream error:', error);
        
        if (error instanceof PokemonAgentError) {
            if (!res.headersSent) {
                res.status(error.statusCode || 500).json({
                    code: error.statusCode || 500,
                    success: false,
                    message: error.message,
                    errorCode: error.code,
                    details: error.details,
                    requestId
                });
            } else {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    errorCode: error.code,
                    message: error.message,
                    details: error.details,
                    requestId
                })}\n\n`);
                res.end();
            }
        } else {
            if (!res.headersSent) {
                res.status(500).json({
                    code: 500,
                    success: false,
                    message: error.message,
                    requestId
                });
            } else {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    message: error.message,
                    requestId
                })}\n\n`);
                res.end();
            }
        }
    }
});

router.post('/stream/cancel/:requestId', (req, res) => {
    const { requestId } = req.params;
    const cancelled = pokemonAgentClient.cancelRequest(requestId);
    
    res.json({
        code: 200,
        success: true,
        data: {
            requestId,
            cancelled,
            message: cancelled ? '请求已取消' : '请求不存在或已完成'
        }
    });
});

router.get('/stream/active', (req, res) => {
    const activeRequests = pokemonAgentClient.getActiveRequests();
    
    res.json({
        code: 200,
        success: true,
        data: {
            count: activeRequests.length,
            requests: activeRequests
        }
    });
});

router.post('/history', async (req, res) => {
    try {
        const { userId, sessionId } = req.body;
        
        if (!userId || !sessionId) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: '缺少必需参数：userId, sessionId'
            });
        }
        
        const history = await pokemonAgentClient.getChatHistory(userId, sessionId);
        
        res.json({
            code: 200,
            success: true,
            data: history
        });
        
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({
            code: 500,
            success: false,
            message: error.message
        });
    }
});

router.post('/preview', (req, res) => {
    try {
        const { birthDate, timeIndex, gender, occupation } = req.body;
        
        const validation = validateAiDataParams(birthDate, timeIndex, gender);
        if (!validation.valid) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: validation.message
            });
        }
        
        const aiDataOutput = getAiDataInternal(birthDate, validation.timeIndexNum, gender);
        const agentInput = pokemonAgentClient.transformAiDataToAgentInput(
            aiDataOutput,
            'preview_user',
            'preview_session'
        );
        
        res.json({
            code: 200,
            success: true,
            data: {
                aiData: aiDataOutput,
                transformedPrompt: agentInput.message
            }
        });
        
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({
            code: 500,
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
