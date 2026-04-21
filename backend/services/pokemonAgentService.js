const http = require('http');
const https = require('https');
const { URL } = require('url');

const CONFIG = {
  baseUrl: process.env.POKEMON_AGENT_BASE_URL || 'http://localhost:8000',
  timeout: parseInt(process.env.POKEMON_AGENT_TIMEOUT) || 120000
};

class PokemonAgentError extends Error {
  constructor(message, code, statusCode = null, details = null) {
    super(message);
    this.name = 'PokemonAgentError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Keyed by requestId for cancellation support
const activeRequests = new Map();

function buildFatePrompt(aiDataOutput) {
  const { bySolar, majorPeriods } = aiDataOutput;
  let prompt = '请根据以下紫微斗数命盘信息进行分析解读：\n\n';

  if (bySolar) {
    prompt += '【基本信息】\n';
    prompt += `性别: ${bySolar.gender || '未知'}\n`;
    prompt += `阳历生日: ${bySolar.solarDate || '未知'}\n`;
    prompt += `阴历生日: ${bySolar.lunarDate || '未知'}\n`;
    prompt += `生肖: ${bySolar.zodiac || '未知'}\n`;
    prompt += `星座: ${bySolar.sign || '未知'}\n`;
    prompt += `命主: ${bySolar.soul || '未知'}\n`;
    prompt += `身主: ${bySolar.body || '未知'}\n`;
    prompt += `五行局: ${bySolar.fiveElementsClass || '未知'}\n\n`;

    if (bySolar.palaces && bySolar.palaces.length > 0) {
      prompt += '【十二宫信息】\n';
      bySolar.palaces.forEach(palace => {
        prompt += `\n${palace.name}宫 (${palace.heavenlyStem}${palace.earthlyBranch}):\n`;
        if (palace.majorStars && palace.majorStars.length > 0) {
          prompt += `  主星: ${palace.majorStars.map(s => `${s.name}(${s.brightness || ''}${s.mutagen || ''})`).join(', ')}\n`;
        }
        if (palace.decadal && palace.decadal.range) {
          prompt += `  大限: ${palace.decadal.range.join('-')}岁\n`;
        }
      });
    }
  }

  if (majorPeriods && majorPeriods.length > 0) {
    prompt += '\n【大限运程】\n';
    majorPeriods.slice(0, 3).forEach(period => {
      if (period.range) {
        prompt += `${period.range[0]}-${period.range[1]}岁\n`;
      }
    });
  }

  return prompt;
}

function _makeRequest(urlStr, body) {
  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  const bodyStr = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = httpModule.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, resolve);
    req.on('error', err =>
      reject(new PokemonAgentError(`请求失败: ${err.message}`, 'REQUEST_FAILED'))
    );
    req.write(bodyStr);
    req.end();
  });
}

// Calls upstream /chat/gen_fate to register the natal chart context for a session.
async function initFate(userId, sessionId, userFate) {
  const res = await _makeRequest(`${CONFIG.baseUrl}/chat/gen_fate`, {
    user_id: userId,
    session_id: sessionId,
    user_fate: userFate
  });

  let body = '';
  for await (const chunk of res) { body += chunk; }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new PokemonAgentError(
      `gen_fate 返回 ${res.statusCode}`,
      'GEN_FATE_ERROR',
      res.statusCode,
      { response: body }
    );
  }
  return body;
}

// Streams response chunks from upstream /chat/stream.
// Yields plain content strings (already extracted from upstream SSE lines).
async function* streamChatMessage(userId, sessionId, message, options = {}) {
  const { requestId, timeout = CONFIG.timeout } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (requestId) {
    activeRequests.set(requestId, { controller, startTime: Date.now() });
  }

  try {
    const url = new URL(`${CONFIG.baseUrl}/chat/stream`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const bodyStr = JSON.stringify({ user_id: userId, session_id: sessionId, message });

    const response = await new Promise((resolve, reject) => {
      const req = httpModule.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      }, resolve);
      req.on('error', err =>
        reject(new PokemonAgentError(`chat/stream 请求失败: ${err.message}`, 'REQUEST_FAILED'))
      );
      req.write(bodyStr);
      req.end();
    });

    clearTimeout(timeoutId);

    if (response.statusCode !== 200) {
      let errBody = '';
      for await (const chunk of response) { errBody += chunk; }
      throw new PokemonAgentError(
        `chat/stream 返回 ${response.statusCode}`,
        'AGENT_ERROR',
        response.statusCode,
        { response: errBody }
      );
    }

    let buffer = '';
    for await (const chunk of response) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw);
          // Normalise upstream delta formats: {content}, {delta}, {text}, or raw string
          const content = parsed.content ?? parsed.delta ?? parsed.text ?? null;
          if (typeof content === 'string' && content) yield content;
        } catch {
          // upstream sent a non-JSON fragment; yield as-is
          yield raw;
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new PokemonAgentError('请求超时或已取消', 'TIMEOUT_OR_CANCELLED');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (requestId) activeRequests.delete(requestId);
  }
}

async function getChatHistory(userId, sessionId) {
  const res = await _makeRequest(`${CONFIG.baseUrl}/chat/history`, {
    user_id: userId,
    session_id: sessionId
  });

  let body = '';
  for await (const chunk of res) { body += chunk; }

  try {
    return JSON.parse(body);
  } catch {
    throw new PokemonAgentError('解析历史记录失败', 'PARSE_ERROR');
  }
}

function cancelRequest(requestId) {
  const entry = activeRequests.get(requestId);
  if (entry) {
    entry.controller.abort();
    activeRequests.delete(requestId);
    return true;
  }
  return false;
}

function getActiveRequestsList() {
  return Array.from(activeRequests.entries()).map(([id, data]) => ({
    requestId: id,
    startTime: data.startTime,
    duration: Date.now() - data.startTime
  }));
}

module.exports = {
  PokemonAgentError,
  buildFatePrompt,
  initFate,
  streamChatMessage,
  getChatHistory,
  cancelRequest,
  getActiveRequestsList
};
