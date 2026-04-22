const http = require('http');
const https = require('https');
const { URL } = require('url');
const { StringDecoder } = require('string_decoder');

const CONFIG = {
  baseUrl: process.env.POKEMON_AGENT_BASE_URL || 'http://127.0.0.1:8000',
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

function normaliseContentPayload(payload) {
  if (typeof payload === 'string') return payload;

  if (Array.isArray(payload)) {
    return payload
      .map(item => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        if (item.type && item.type !== 'text' && item.type !== 'output_text') return '';
        if (typeof item.text === 'string') return item.text;
        if (typeof item.content === 'string') return item.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (payload && typeof payload === 'object') {
    if (payload.type && payload.type !== 'text' && payload.type !== 'output_text') return '';
    if (typeof payload.text === 'string') return payload.text;
    if (typeof payload.content === 'string') return payload.content;
  }

  return '';
}

function getAssistantContent(parsed) {
  const payload = parsed && parsed.type === 'chunk' && parsed.data ? parsed.data : parsed;
  if (!payload || typeof payload !== 'object') return '';

  const messageType = String(payload.type || '').toLowerCase();
  if (messageType.includes('tool') || messageType.includes('human') || messageType.includes('system')) {
    return '';
  }

  const content = normaliseContentPayload(payload.content ?? payload.delta ?? payload.text ?? null);
  if (!content || looksLikeInternalDump(content)) return '';
  return content;
}

function looksLikeInternalDump(content) {
  const text = String(content || '').trim();
  if (!text) return false;

  // Prevent Python dict / internal chart data from being displayed as an answer.
  if (/^\{['"]?\d{4}['"]?\s*:/.test(text) && /['"]status['"]\s*:/.test(text)) return true;
  if (/^\{.*['"]details['"]\s*:/s.test(text) && /['"]index['"]\s*:/s.test(text)) return true;

  return false;
}

function parseAgentSseLine(line) {
  if (!line.startsWith('data: ')) return '';

  const raw = line.slice(6).trim();
  if (!raw || raw === '[DONE]') return '';

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'error') {
      const message = parsed.message || parsed.error?.message || parsed.detail || '上游 Agent 返回错误';
      throw new PokemonAgentError(message, 'UPSTREAM_STREAM_ERROR', null, parsed);
    }
    return getAssistantContent(parsed);
  } catch (err) {
    if (err instanceof PokemonAgentError) throw err;
    console.warn('Ignoring non-JSON agent SSE line:', raw.slice(0, 120));
    return '';
  }
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

    const decoder = new StringDecoder('utf8');
    let buffer = '';
    for await (const chunk of response) {
      buffer += decoder.write(chunk);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const content = parseAgentSseLine(line);
        if (content) yield content;
      }
    }

    buffer += decoder.end();
    if (buffer.trim()) {
      const content = parseAgentSseLine(buffer);
      if (content) yield content;
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
