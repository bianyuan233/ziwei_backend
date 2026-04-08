#!/bin/bash

SERVER_DIR="/home/ubuntu/backend_260314/ziwei_backend/backend"
LOG_FILE="/home/ubuntu/backend_260314/ziwei_backend/backend/server_restart.log"
API_URL="http://localhost:3000/api/aiData"
PORT=3000
MAX_RETRIES=10
RETRY_INTERVAL=2

NODE_PATH="/home/ubuntu/.trae-cn-server/bin/stable-bb6e8bb12cb531e3a20400e8abe0087f25a69f59-debian10/node"

if [ ! -x "$NODE_PATH" ]; then
    NODE_PATH=$(find /home/ubuntu/.trae-cn-server/bin -name "node" -type f 2>/dev/null | head -1)
fi

TEST_DATA='{"birthDate":"1990-05-15","timeIndex":2,"gender":"男"}'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_section() {
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "$1" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
}

check_system_status() {
    log_section "系统状态检查"
    
    log "检查磁盘空间..."
    DISK_USAGE=$(df -h "$SERVER_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "警告: 磁盘使用率 ${DISK_USAGE}%，超过90%"
        return 1
    fi
    log "磁盘使用率: ${DISK_USAGE}% - 正常"
    
    log "检查内存使用..."
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        log "警告: 内存使用率 ${MEMORY_USAGE}%，超过90%"
        return 1
    fi
    log "内存使用率: ${MEMORY_USAGE}% - 正常"
    
    log "检查端口 $PORT 占用情况..."
    PORT_PROCESS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | head -1)
    if [ -n "$PORT_PROCESS" ]; then
        log "端口 $PORT 当前被占用: $PORT_PROCESS"
        PORT_OCCUPIED=1
    else
        log "端口 $PORT 当前空闲"
        PORT_OCCUPIED=0
    fi
    
    log "系统状态检查完成"
    return 0
}

stop_server() {
    log_section "停止服务器"
    
    OLD_PID=$(ps aux | grep "node.*server.js" | grep "$SERVER_DIR" | grep -v grep | awk '{print $2}')
    
    if [ -z "$OLD_PID" ]; then
        log "未发现运行中的服务器进程"
    else
        log "发现服务器进程 PID: $OLD_PID"
        log "尝试停止服务器..."
        
        kill "$OLD_PID" 2>/dev/null
        
        for i in $(seq 1 5); do
            sleep 1
            if ! ps -p "$OLD_PID" > /dev/null 2>&1; then
                log "服务器进程已停止"
                break
            fi
            log "等待进程停止... ($i/5)"
        done
        
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            log "进程未响应，尝试强制终止..."
            kill -9 "$OLD_PID" 2>/dev/null
            sleep 1
        fi
    fi
    
    log "检查端口 $PORT 是否仍被占用..."
    PORT_PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
    
    if [ -n "$PORT_PID" ]; then
        log "端口 $PORT 仍被进程 $PORT_PID 占用，尝试终止..."
        kill -9 "$PORT_PID" 2>/dev/null
        sleep 1
    fi
    
    sleep 2
    
    if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
        log "错误: 无法释放端口 $PORT"
        return 1
    fi
    
    log "端口 $PORT 已释放"
    return 0
}

start_server() {
    log_section "启动服务器"
    
    cd "$SERVER_DIR" || {
        log "错误: 无法进入服务器目录 $SERVER_DIR"
        return 1
    }
    
    if [ ! -x "$NODE_PATH" ]; then
        log "错误: 找不到 node 可执行文件"
        return 1
    fi
    
    log "使用 Node 路径: $NODE_PATH"
    log "启动服务器..."
    nohup "$NODE_PATH" server.js > /tmp/node_server.log 2>&1 &
    NEW_PID=$!
    log "服务器进程已启动，PID: $NEW_PID"
    
    sleep 2
    
    if ! ps -p "$NEW_PID" > /dev/null 2>&1; then
        log "错误: 服务器进程启动后立即退出"
        log "服务器日志:"
        cat /tmp/node_server.log | tee -a "$LOG_FILE"
        return 1
    fi
    
    log "服务器进程运行正常"
    return 0
}

verify_server() {
    log_section "验证服务器状态"
    
    log "等待服务器就绪..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        sleep $RETRY_INTERVAL
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$TEST_DATA" 2>/dev/null)
        
        if [ "$HTTP_CODE" = "200" ]; then
            log "服务器响应正常 (HTTP $HTTP_CODE)"
            return 0
        fi
        
        log "尝试 $i/$MAX_RETRIES: 服务器响应 HTTP $HTTP_CODE"
    done
    
    log "错误: 服务器在 $MAX_RETRIES 次尝试后仍未就绪"
    return 1
}

test_api() {
    log_section "测试API接口"
    
    log "测试参数: 新历1990-05-15, 寅时(4点), 男"
    log "请求URL: $API_URL"
    
    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "$TEST_DATA" 2>/dev/null)
    
    CURL_EXIT_CODE=$?
    
    if [ $CURL_EXIT_CODE -ne 0 ]; then
        log "错误: curl请求失败，退出码: $CURL_EXIT_CODE"
        return 1
    fi
    
    if [ -z "$RESPONSE" ]; then
        log "错误: 服务器返回空响应"
        return 1
    fi
    
    log "API响应成功"
    
    log_section "命理分析结果"
    
    SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    
    if [ "$SUCCESS" != "True" ]; then
        log "错误: API返回失败状态"
        log "响应内容: $RESPONSE"
        return 1
    fi
    
    log "解析命理数据..."
    
    echo "$RESPONSE" | python3 -c "
import sys, json

data = json.load(sys.stdin)
bySolar = data['data']['bySolar']

print('【基本信息】')
print(f'性别: {bySolar[\"gender\"]}')
print(f'阳历: {bySolar[\"solarDate\"]}')
print(f'农历: {bySolar[\"lunarDate\"]}')
print(f'干支: {bySolar[\"chineseDate\"]}')
print(f'时辰: {bySolar[\"time\"]} ({bySolar[\"timeRange\"]})')
print(f'星座: {bySolar[\"sign\"]}')
print(f'生肖: {bySolar[\"zodiac\"]}')
print(f'五行局: {bySolar[\"fiveElementsClass\"]}')
print(f'命宫地支: {bySolar[\"earthlyBranchOfSoulPalace\"]}')
print(f'身宫地支: {bySolar[\"earthlyBranchOfBodyPalace\"]}')
print(f'命主: {bySolar[\"soul\"]}')
print(f'身主: {bySolar[\"body\"]}')

print()
print('【十二宫】')
for p in bySolar['palaces']:
    stars = [s['name'] for s in p['majorStars']]
    minor = [s['name'] for s in p['minorStars']]
    star_str = ', '.join(stars + minor) if stars or minor else '无'
    print(f'{p[\"name\"]}: {p[\"heavenlyStem\"]}{p[\"earthlyBranch\"]} | 主星: {star_str}')

print()
print('【流年周期 (前3年)】')
for yp in data['data']['yearlyPeriods'][:3]:
    print(f'虚岁 {yp[\"age\"]} 岁:')
    for p in yp['palaces'][:4]:
        print(f'  {p[\"name\"]}: month={p.get(\"month\", \"N/A\")}')

print()
print('【大限周期】')
for mp in data['data']['majorPeriods'][:4]:
    print(f'年龄 {mp[\"range\"][0]}-{mp[\"range\"][1]} 岁: 命宫在 {mp[\"palaces\"][0][\"name\"]}')
" 2>&1 | tee -a "$LOG_FILE"
    
    RESULT_FILE="$SERVER_DIR/api_test_result.json"
    echo "$RESPONSE" | python3 -m json.tool > "$RESULT_FILE" 2>/dev/null
    log "完整JSON结果已保存至: $RESULT_FILE"
    
    return 0
}

main() {
    log_section "服务器重启与测试脚本启动"
    log "脚本版本: 1.0"
    log "服务器目录: $SERVER_DIR"
    log "日志文件: $LOG_FILE"
    
    check_system_status
    if [ $? -ne 0 ]; then
        log "警告: 系统状态检查未通过，但继续执行"
    fi
    
    stop_server
    STOP_RESULT=$?
    if [ $STOP_RESULT -ne 0 ]; then
        log "警告: 停止服务器失败，尝试直接测试现有服务..."
    fi
    
    sleep 2
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$TEST_DATA" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ]; then
        log "服务器已就绪 (HTTP $HTTP_CODE)"
    else
        log "服务器未就绪，尝试启动新服务器..."
        start_server
        START_RESULT=$?
        if [ $START_RESULT -ne 0 ]; then
            log "错误: 启动服务器失败"
            exit 1
        fi
        
        verify_server
        VERIFY_RESULT=$?
        if [ $VERIFY_RESULT -ne 0 ]; then
            log "错误: 服务器验证失败"
            exit 1
        fi
    fi
    
    test_api
    TEST_RESULT=$?
    if [ $TEST_RESULT -ne 0 ]; then
        log "错误: API测试失败"
        exit 1
    fi
    
    log_section "执行完成"
    log "所有操作已成功完成"
    log "日志文件: $LOG_FILE"
    log "结果文件: $SERVER_DIR/api_test_result.json"
    
    exit 0
}

main "$@"
