const express = require('express');
const router = express.Router();
const { astro } = require('iztro');
const {
  buildFatePrompt,
  initFate,
  streamChatMessage,
  getChatHistory,
  cancelRequest,
  getActiveRequestsList
} = require('../services/pokemonAgentService');
const { upsertSession } = require('../services/agentSessionStore');

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── iztro helpers (same logic as routes/api.js) ──────────────────────────────

function getBySolarData(ab) {
  if (!ab) return null;
  return {
    gender: ab.gender,
    solarDate: ab.solarDate,
    lunarDate: ab.lunarDate,
    chineseDate: ab.chineseDate,
    rawDates: ab.rawDates,
    time: ab.time,
    timeRange: ab.timeRange,
    sign: ab.sign,
    zodiac: ab.zodiac,
    earthlyBranchOfSoulPalace: ab.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: ab.earthlyBranchOfBodyPalace,
    soul: ab.soul,
    body: ab.body,
    fiveElementsClass: ab.fiveElementsClass,
    palaces: ab.palaces.map(p => ({
      index: p.index,
      name: p.name,
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      isBodyPalace: p.isBodyPalace,
      isOriginalPalace: p.isOriginalPalace,
      majorStars: p.majorStars.map(s => ({ name: s.name, type: s.type, brightness: s.brightness, mutagen: s.mutagen })),
      minorStars: p.minorStars.map(s => ({ name: s.name, type: s.type, brightness: s.brightness, mutagen: s.mutagen })),
      adjectiveStars: p.adjectiveStars.map(s => ({ name: s.name, type: s.type })),
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
  if (!astrolabe || !Array.isArray(astrolabe.palaces)) return [];
  const sorted = [...astrolabe.palaces].sort((a, b) => {
    const ra = a.decadal && a.decadal.range ? a.decadal.range[0] : Infinity;
    const rb = b.decadal && b.decadal.range ? b.decadal.range[0] : Infinity;
    return ra - rb;
  });
  const periods = [];
  const birthYear = parseInt(astrolabe.solarDate.split('-')[0]);
  for (let i = 0; i < 12; i++) {
    const palace = sorted[i];
    if (!palace || !palace.decadal) continue;
    const range = palace.decadal.range;
    const midAge = Math.floor((range[0] + range[1]) / 2);
    const targetDate = new Date(birthYear + midAge, 5, 15);
    try {
      const hd = astrolabe.horoscope(targetDate);
      periods.push({ range, palaces: hd.decadal.palaceNames.map((name, idx) => ({ index: idx, name })) });
    } catch {
      periods.push({ range, palaces: [] });
    }
  }
  return periods;
}

function getYearlyPeriods(astrolabe) {
  if (!astrolabe || !astrolabe.palaces) return [];
  const birthYear = parseInt(astrolabe.solarDate.split('-')[0]);
  const yearly = [];
  for (let i = 0; i < 12; i++) {
    const targetDate = new Date(birthYear + i, 5, 15);
    try {
      const hd = astrolabe.horoscope(targetDate);
      yearly.push({ age: hd.age.nominalAge, palaces: hd.yearly.palaceNames.map((name, idx) => ({ index: idx, name })) });
    } catch {
      yearly.push({ age: i + 1, palaces: [] });
    }
  }
  return yearly;
}

function validateAiDataParams(birthDate, timeIndex, gender) {
  if (!birthDate || timeIndex === undefined || timeIndex === null || timeIndex === '' || !gender) {
    return { valid: false, message: '缺少必需参数：birthDate(YYYY-MM-DD), timeIndex(0-12), gender(男/女)' };
  }
  const num = parseInt(timeIndex, 10);
  if (isNaN(num) || num < 0 || num > 12) {
    return { valid: false, message: 'timeIndex 必须是 0-12 之间的整数' };
  }
  if (gender !== '男' && gender !== '女') {
    return { valid: false, message: 'gender 必须是 "男" 或 "女"' };
  }
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(birthDate)) {
    return { valid: false, message: 'birthDate 格式必须为 YYYY-MM-DD' };
  }
  return { valid: true, timeIndexNum: num };
}

function getAiDataInternal(birthDate, timeIndexNum, gender) {
  const astrolabeBySolar = astro.bySolar(birthDate, timeIndexNum, gender);
  const astrolabe = astro.astrolabeBySolarDate(birthDate, timeIndexNum, gender, true, 'zh-CN');
  return {
    bySolar: getBySolarData(astrolabeBySolar),
    majorPeriods: getMajorPeriods(astrolabe),
    yearlyPeriods: getYearlyPeriods(astrolabe)
  };
}

// ── SSE helper ────────────────────────────────────────────────────────────────

function sseHeaders(res, requestId) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Request-Id', requestId);
}

function writeSSE(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/agent/stream
// Body: { birthDate, timeIndex, gender, occupation?, userId, sessionId, question }
// Response: SSE stream  meta → delta* → done | error
router.post('/stream', async (req, res) => {
  const requestId = genId();
  const { birthDate, timeIndex, gender, occupation, userId, sessionId, question } = req.body;

  // 1. Validate
  if (!birthDate || timeIndex === undefined || timeIndex === null || timeIndex === '' ||
      !gender || !userId || !sessionId || !question) {
    return res.status(400).json({
      code: 400, success: false, requestId,
      message: '缺少必需参数：birthDate, timeIndex, gender, userId, sessionId, question'
    });
  }

  const validation = validateAiDataParams(birthDate, timeIndex, gender);
  if (!validation.valid) {
    return res.status(400).json({ code: 400, success: false, requestId, message: validation.message });
  }

  // 2. Generate aiData from iztro
  let aiData;
  try {
    aiData = getAiDataInternal(birthDate, validation.timeIndexNum, gender);
  } catch (err) {
    return res.status(400).json({ code: 400, success: false, requestId, message: `命盘生成失败: ${err.message}` });
  }

  // 3. Build fate prompt
  const userFate = buildFatePrompt(aiData);

  // 4. Persist session metadata (non-fatal)
  try {
    upsertSession({
      userId, sessionId,
      birthDate,
      timeIndex: validation.timeIndexNum,
      gender,
      occupation: occupation || '',
      userFate
    });
  } catch (dbErr) {
    console.error('Session upsert error (non-fatal):', dbErr.message);
  }

  // 5. Open SSE channel and emit meta
  sseHeaders(res, requestId);
  writeSSE(res, { type: 'meta', requestId, sessionId });

  try {
    // 6. Register natal chart context with upstream agent
    await initFate(userId, sessionId, aiData);

    // 7. Stream the conversational answer
    for await (const content of streamChatMessage(userId, sessionId, question, { requestId })) {
      writeSSE(res, { type: 'delta', content });
    }

    writeSSE(res, { type: 'done' });
    res.end();
  } catch (err) {
    console.error('Agent stream error:', err.message);
    writeSSE(res, { type: 'error', message: err.message });
    res.end();
  }
});

// POST /api/agent/stream/cancel/:requestId
router.post('/stream/cancel/:requestId', (req, res) => {
  const { requestId } = req.params;
  const cancelled = cancelRequest(requestId);
  res.json({
    code: 200, success: true,
    data: { requestId, cancelled, message: cancelled ? '请求已取消' : '请求不存在或已完成' }
  });
});

// GET /api/agent/stream/active
router.get('/stream/active', (_req, res) => {
  const requests = getActiveRequestsList();
  res.json({ code: 200, success: true, data: { count: requests.length, requests } });
});

// POST /api/agent/history
router.post('/history', async (req, res) => {
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) {
    return res.status(400).json({ code: 400, success: false, message: '缺少 userId, sessionId' });
  }
  try {
    const history = await getChatHistory(userId, sessionId);
    res.json({ code: 200, success: true, data: history });
  } catch (err) {
    res.status(500).json({ code: 500, success: false, message: err.message });
  }
});

module.exports = router;
