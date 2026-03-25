const http = require('http');
const https = require('https');
const { URL } = require('url');
const { EventEmitter } = require('events');

const POKEMON_AGENT_CONFIG = {
    host: process.env.POKEMON_AGENT_HOST || 'localhost',
    port: process.env.POKEMON_AGENT_PORT || 8000,
    baseUrl: process.env.POKEMON_AGENT_BASE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.POKEMON_AGENT_TIMEOUT) || 120000,
    maxRetries: parseInt(process.env.POKEMON_AGENT_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.POKEMON_AGENT_RETRY_DELAY) || 1000
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

class PokemonAgentClient extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { ...POKEMON_AGENT_CONFIG, ...config };
        this.activeRequests = new Map();
    }

    transformAiDataToAgentInput(aiDataOutput, userId, sessionId) {
        const { bySolar, majorPeriods, yearlyPeriods } = aiDataOutput;
        
        const prompt = this._buildPromptFromAiData(aiDataOutput);
        
        return {
            user_id: userId || `user_${Date.now()}`,
            session_id: sessionId || `session_${Date.now()}`,
            message: prompt
        };
    }

    _buildPromptFromAiData(aiDataOutput) {
        const { bySolar, majorPeriods, yearlyPeriods } = aiDataOutput;
        
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
                    if (palace.minorStars && palace.minorStars.length > 0) {
                        prompt += `  辅星: ${palace.minorStars.map(s => s.name).join(', ')}\n`;
                    }
                    if (palace.decadal) {
                        prompt += `  大限: ${palace.decadal.range ? palace.decadal.range.join('-') : ''}岁\n`;
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
        
        prompt += '\n请对以上命盘信息进行详细解读，包括性格特点、事业运势、财运分析等方面。';
        
        return prompt;
    }

    async *streamChat(requestData, options = {}) {
        const { timeout = this.config.timeout, requestId = this._generateRequestId() } = options;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        this.activeRequests.set(requestId, {
            controller,
            startTime: Date.now(),
            requestData
        });
        
        try {
            const url = new URL(`${this.config.baseUrl}/chat/stream`);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const requestBody = JSON.stringify(requestData);
            
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal
            };
            
            const response = await new Promise((resolve, reject) => {
                const req = httpModule.request(requestOptions, resolve);
                
                req.on('error', (error) => {
                    clearTimeout(timeoutId);
                    reject(new PokemonAgentError(
                        `请求失败: ${error.message}`,
                        'REQUEST_FAILED',
                        null,
                        { originalError: error.message }
                    ));
                });
                
                req.write(requestBody);
                req.end();
            });
            
            clearTimeout(timeoutId);
            
            if (response.statusCode !== 200) {
                let errorBody = '';
                for await (const chunk of response) {
                    errorBody += chunk;
                }
                throw new PokemonAgentError(
                    `大模型服务返回错误: ${response.statusCode}`,
                    'AGENT_ERROR',
                    response.statusCode,
                    { response: errorBody }
                );
            }
            
            let buffer = '';
            
            for await (const chunk of response) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr) {
                            try {
                                const data = JSON.parse(dataStr);
                                yield {
                                    type: 'chunk',
                                    requestId,
                                    data,
                                    timestamp: Date.now()
                                };
                            } catch (parseError) {
                                yield {
                                    type: 'raw',
                                    requestId,
                                    data: dataStr,
                                    timestamp: Date.now()
                                };
                            }
                        }
                    }
                }
            }
            
            yield {
                type: 'done',
                requestId,
                timestamp: Date.now()
            };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new PokemonAgentError(
                    '请求超时',
                    'TIMEOUT',
                    null,
                    { timeout }
                );
            }
            throw error;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    async streamChatWithRetry(requestData, options = {}) {
        const { maxRetries = this.config.maxRetries, retryDelay = this.config.retryDelay } = options;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return this.streamChat(requestData, { ...options, attempt });
            } catch (error) {
                lastError = error;
                
                if (error.code === 'TIMEOUT' || error.code === 'REQUEST_FAILED') {
                    this.emit('retry', { attempt, maxRetries, error });
                    
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                    }
                } else {
                    throw error;
                }
            }
        }
        
        throw lastError;
    }

    cancelRequest(requestId) {
        const request = this.activeRequests.get(requestId);
        if (request) {
            request.controller.abort();
            this.activeRequests.delete(requestId);
            return true;
        }
        return false;
    }

    cancelAllRequests() {
        const count = this.activeRequests.size;
        for (const [requestId, request] of this.activeRequests) {
            request.controller.abort();
        }
        this.activeRequests.clear();
        return count;
    }

    getActiveRequests() {
        return Array.from(this.activeRequests.entries()).map(([id, data]) => ({
            requestId: id,
            startTime: data.startTime,
            duration: Date.now() - data.startTime
        }));
    }

    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getChatHistory(userId, sessionId) {
        const url = new URL(`${this.config.baseUrl}/chat/history`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const requestBody = JSON.stringify({
            user_id: userId,
            session_id: sessionId
        });
        
        return new Promise((resolve, reject) => {
            const req = httpModule.request({
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new PokemonAgentError('解析历史记录失败', 'PARSE_ERROR'));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(requestBody);
            req.end();
        });
    }
}

const pokemonAgentClient = new PokemonAgentClient();

module.exports = {
    PokemonAgentClient,
    PokemonAgentError,
    pokemonAgentClient,
    POKEMON_AGENT_CONFIG
};
