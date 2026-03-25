/**
 * 离心机数字化监控系统 - 前端应用
 * Centrifuge Monitor System Frontend
 */

// API基础URL - 使用相对路径以支持HTTPS代理
const API_BASE_URL = '/api';

// 应用状态
const AppState = {
    currentView: 'dashboard',
    currentFilter: 'all',
    devices: [],
    communicationActive: false,
    selectedDevice: null,
    refreshInterval: null
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 初始化UI组件
    initSidebar();
    initSearchBox();
    initFilterTabs();
    initCommunicationButtons();
    initViewNavigation();
    
    // 加载设备数据
    loadDevices();
    
    // 更新时间显示
    updateTime();
    setInterval(updateTime, 1000);
    
    // 启动自动刷新
    startAutoRefresh();
}

/**
 * 侧边栏初始化
 */
function initSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    
    // 导航菜单项点击
    document.querySelectorAll('.nav-item > a').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const navItem = item.parentElement;
            const page = navItem.dataset.page;
            
            // 切换激活状态
            document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
            navItem.classList.add('active');
            
            // 处理页面切换
            if (page === 'dashboard') {
                showView('dashboardView');
            } else if (page === 'records') {
                showView('deviceListView');
                loadDeviceList();
            }
        });
    });
    
    // 子菜单项点击
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.submenu-item').forEach(si => si.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.dataset.view;
            if (view === 'operation-eval') {
                showView('dashboardView');
            } else if (view === 'sample-eval') {
                showToast('样本数据评估功能开发中...', 'info');
            }
        });
    });
}

/**
 * 搜索框初始化
 */
function initSearchBox() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchDropdown = document.getElementById('searchDropdown');
    
    // 输入时显示下拉建议
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value.length > 0) {
            searchDropdown.classList.add('show');
            updateSearchSuggestions(value);
        } else {
            searchDropdown.classList.remove('show');
        }
    });
    
    // 点击搜索按钮
    searchBtn.addEventListener('click', () => {
        const value = searchInput.value.trim();
        if (value) {
            searchDevices(value);
        }
    });
    
    // 回车搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const value = searchInput.value.trim();
            if (value) {
                searchDevices(value);
                searchDropdown.classList.remove('show');
            }
        }
    });
    
    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            searchDropdown.classList.remove('show');
        }
    });
    
    // 搜索建议项点击
    document.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
            const value = item.querySelector('.search-value').textContent;
            searchInput.value = value;
            searchDropdown.classList.remove('show');
            searchDevices(value);
        });
    });
}

/**
 * 更新搜索建议
 */
function updateSearchSuggestions(keyword) {
    const suggestions = AppState.devices
        .filter(d => 
            d.name.includes(keyword) || 
            d.serialNumber.includes(keyword) || 
            d.ipAddress.includes(keyword)
        )
        .slice(0, 5);
    
    const dropdown = document.getElementById('searchDropdown');
    dropdown.innerHTML = suggestions.map(d => `
        <div class="search-item" data-device-id="${d.id}">
            <span class="search-label">名称:</span>
            <span class="search-value">${d.name}</span>
        </div>
    `).join('');
    
    // 重新绑定点击事件
    dropdown.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
            const deviceId = item.dataset.deviceId;
            const device = AppState.devices.find(d => d.id == deviceId);
            if (device) {
                showDeviceDetail(device);
                document.getElementById('searchInput').value = device.name;
                dropdown.classList.remove('show');
            }
        });
    });
}

/**
 * 筛选标签初始化
 */
function initFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            AppState.currentFilter = tab.dataset.filter;
            renderDeviceCards();
        });
    });
}

/**
 * 通信按钮初始化
 */
function initCommunicationButtons() {
    const startBtn = document.getElementById('startCommBtn');
    const stopBtn = document.getElementById('stopCommBtn');
    
    startBtn.addEventListener('click', () => {
        startCommunication();
    });
    
    stopBtn.addEventListener('click', () => {
        stopCommunication();
    });
}

/**
 * 视图导航初始化
 */
function initViewNavigation() {
    // 返回概览页面
    document.getElementById('backToDashboard').addEventListener('click', () => {
        showView('dashboardView');
    });
}

/**
 * 显示指定视图
 */
function showView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    AppState.currentView = viewId;
}

/**
 * 加载设备数据
 */
async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/devices`);
        const result = await response.json();
        
        if (result.success) {
            AppState.devices = result.data;
            renderDeviceCards();
            updateSystemStatus('设备数据已更新');
        } else {
            showToast('加载设备数据失败', 'error');
        }
    } catch (error) {
        console.error('加载设备数据错误:', error);
        // 使用模拟数据
        loadMockData();
    }
}

/**
 * 加载模拟数据（当API不可用时）
 */
function loadMockData() {
    AppState.devices = [
        {
            id: 1,
            name: '12345678901234567890',
            type: 'MX30R',
            serialNumber: '12345678901234567890',
            ipAddress: '162.166.166.166',
            speed: 20000,
            time: 20,
            temperature: 4,
            status: 'offline',
            realtimeSpeed: 9370,
            realtimeTime: 0,
            realtimeTemp: 20,
            programName: '这是程序条码名,限定16位字符.',
            settingSpeed: 10000,
            settingTime: 30,
            settingTemp: 20,
            accelLevel: 9,
            decelLevel: 10,
            noBrakeSpeed: 500
        },
        {
            id: 2,
            name: '二号厂房12345',
            type: 'MX30R',
            serialNumber: '12345678',
            ipAddress: '192.168.1.100',
            speed: 15000,
            time: 15,
            temperature: 4,
            status: 'running',
            realtimeSpeed: 15000,
            realtimeTime: 12,
            realtimeTemp: 4,
            programName: '标准程序01',
            settingSpeed: 15000,
            settingTime: 15,
            settingTemp: 4,
            accelLevel: 5,
            decelLevel: 5,
            noBrakeSpeed: 300
        }
    ];
    
    // 生成更多模拟设备
    for (let i = 3; i <= 20; i++) {
        AppState.devices.push({
            id: i,
            name: `离心机${String(i).padStart(2, '0')}`,
            type: i % 3 === 0 ? '其他型号' : 'MX30R',
            serialNumber: `SN${String(i).padStart(8, '0')}`,
            ipAddress: `192.168.1.${100 + i}`,
            speed: 20000,
            time: 20,
            temperature: 4,
            status: i % 5 === 0 ? 'running' : 'offline',
            realtimeSpeed: i % 5 === 0 ? 18000 : 0,
            realtimeTime: i % 5 === 0 ? 10 : 0,
            realtimeTemp: i % 5 === 0 ? 4 : 20,
            programName: `程序${String(i).padStart(2, '0')}`,
            settingSpeed: 20000,
            settingTime: 20,
            settingTemp: 4,
            accelLevel: 9,
            decelLevel: 10,
            noBrakeSpeed: 500
        });
    }
    
    renderDeviceCards();
    updateSystemStatus('已加载模拟数据');
}

/**
 * 渲染设备卡片
 */
function renderDeviceCards() {
    const grid = document.getElementById('deviceGrid');
    
    let filteredDevices = AppState.devices;
    if (AppState.currentFilter !== 'all') {
        filteredDevices = AppState.devices.filter(d => 
            AppState.currentFilter === 'MX30R' ? d.type === 'MX30R' : d.type !== 'MX30R'
        );
    }
    
    grid.innerHTML = filteredDevices.map(device => `
        <div class="device-card" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-name">离心机名称:${device.name}</div>
            </div>
            <div class="device-info">
                <div class="info-item">
                    <span class="label">转速:</span>
                    <span class="value">${device.speed} rpm</span>
                </div>
                <div class="info-item">
                    <span class="label">时间:</span>
                    <span class="value">${device.time} min</span>
                </div>
                <div class="info-item">
                    <span class="label">温度:</span>
                    <span class="value">${device.temperature} ℃</span>
                </div>
                <div class="info-item">
                    <span class="label">状态:</span>
                    <span class="value ${device.status === 'offline' ? 'status-offline' : ''}">
                        ${device.status === 'offline' ? '离线' : '运行中'}
                    </span>
                </div>
            </div>
            <div class="device-actions">
                <button class="btn btn-primary btn-view-detail" data-device-id="${device.id}">
                    查看详情
                </button>
            </div>
        </div>
    `).join('');
    
    // 绑定查看详情按钮事件
    document.querySelectorAll('.btn-view-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const deviceId = btn.dataset.deviceId;
            const device = AppState.devices.find(d => d.id == deviceId);
            if (device) {
                showDeviceDetail(device);
            }
        });
    });
}

/**
 * 显示设备详情
 */
function showDeviceDetail(device) {
    AppState.selectedDevice = device;
    
    // 填充详情数据
    document.getElementById('detailDeviceName').textContent = device.name;
    document.getElementById('detailType').textContent = device.type;
    document.getElementById('detailName').textContent = device.name;
    document.getElementById('detailSerial').textContent = device.serialNumber;
    document.getElementById('detailIp').textContent = device.ipAddress;
    
    document.getElementById('realtimeSpeed').textContent = `${device.realtimeSpeed} rpm`;
    document.getElementById('realtimeTime').textContent = `${device.realtimeTime} min`;
    document.getElementById('realtimeTemp').textContent = `${device.realtimeTemp} ℃`;
    document.getElementById('realtimeProgram').textContent = device.programName;
    
    const statusEl = document.getElementById('realtimeStatus');
    if (device.status === 'running') {
        statusEl.textContent = '正在运行';
        statusEl.className = 'value status-running';
    } else {
        statusEl.textContent = '已停止';
        statusEl.className = 'value status-stopped';
    }
    
    document.getElementById('settingSpeed').textContent = `${device.settingSpeed} rpm`;
    document.getElementById('settingTime').textContent = `${device.settingTime} min`;
    document.getElementById('settingTemp').textContent = `${device.settingTemp} ℃`;
    document.getElementById('settingAccel').textContent = device.accelLevel;
    document.getElementById('settingDecel').textContent = device.decelLevel;
    document.getElementById('settingNoBrake').textContent = `${device.noBrakeSpeed} rpm`;
    
    showView('deviceDetailView');
}

/**
 * 加载设备列表（表格视图）
 */
function loadDeviceList() {
    const tbody = document.getElementById('deviceTableBody');
    
    tbody.innerHTML = AppState.devices.map((device, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${device.name}</td>
            <td>${device.serialNumber}</td>
            <td>${device.ipAddress}</td>
            <td>
                <span class="status-badge ${device.status === 'running' ? 'online' : 'offline'}">
                    ${device.status === 'running' ? '运行中' : '离线'}
                </span>
            </td>
        </tr>
    `).join('');
}

/**
 * 搜索设备
 */
function searchDevices(keyword) {
    const matched = AppState.devices.filter(d => 
        d.name.includes(keyword) || 
        d.serialNumber.includes(keyword) || 
        d.ipAddress.includes(keyword)
    );
    
    if (matched.length > 0) {
        // 高亮匹配的设备卡片
        document.querySelectorAll('.device-card').forEach(card => {
            card.style.opacity = '0.5';
        });
        
        matched.forEach(device => {
            const card = document.querySelector(`.device-card[data-device-id="${device.id}"]`);
            if (card) {
                card.style.opacity = '1';
                card.style.boxShadow = '0 0 0 2px #1e88e5';
            }
        });
        
        showToast(`找到 ${matched.length} 个匹配设备`, 'success');
        
        // 3秒后恢复
        setTimeout(() => {
            document.querySelectorAll('.device-card').forEach(card => {
                card.style.opacity = '';
                card.style.boxShadow = '';
            });
        }, 3000);
    } else {
        showToast('未找到匹配的设备', 'info');
    }
}

/**
 * 开始通信
 */
async function startCommunication() {
    try {
        const response = await fetch(`${API_BASE_URL}/communication/start`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            AppState.communicationActive = true;
            document.getElementById('startCommBtn').disabled = true;
            document.getElementById('stopCommBtn').disabled = false;
            showToast('通信已启动', 'success');
            updateSystemStatus('通信运行中');
        } else {
            showToast(result.message || '启动通信失败', 'error');
        }
    } catch (error) {
        // 模拟成功
        AppState.communicationActive = true;
        document.getElementById('startCommBtn').disabled = true;
        document.getElementById('stopCommBtn').disabled = false;
        showToast('通信已启动（模拟模式）', 'success');
        updateSystemStatus('通信运行中（模拟）');
    }
}

/**
 * 停止通信
 */
async function stopCommunication() {
    try {
        const response = await fetch(`${API_BASE_URL}/communication/stop`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            AppState.communicationActive = false;
            document.getElementById('startCommBtn').disabled = false;
            document.getElementById('stopCommBtn').disabled = true;
            showToast('通信已停止', 'info');
            updateSystemStatus('通信已停止');
        } else {
            showToast(result.message || '停止通信失败', 'error');
        }
    } catch (error) {
        // 模拟成功
        AppState.communicationActive = false;
        document.getElementById('startCommBtn').disabled = false;
        document.getElementById('stopCommBtn').disabled = true;
        showToast('通信已停止（模拟模式）', 'info');
        updateSystemStatus('通信已停止（模拟）');
    }
}

/**
 * 启动自动刷新
 */
function startAutoRefresh() {
    // 每30秒刷新一次设备数据
    AppState.refreshInterval = setInterval(() => {
        if (AppState.currentView === 'dashboardView') {
            // 模拟数据更新
            AppState.devices.forEach(device => {
                if (device.status === 'running') {
                    device.realtimeTime += 1;
                    // 随机波动转速
                    device.realtimeSpeed = device.settingSpeed + Math.floor(Math.random() * 200 - 100);
                }
            });
            
            // 如果当前在详情页，更新详情数据
            if (AppState.selectedDevice && document.getElementById('deviceDetailView').classList.contains('active')) {
                const updated = AppState.devices.find(d => d.id === AppState.selectedDevice.id);
                if (updated) {
                    showDeviceDetail(updated);
                }
            }
        }
    }, 5000);
}

/**
 * 更新系统状态
 */
function updateSystemStatus(message) {
    const statusEl = document.getElementById('systemStatus');
    const now = new Date().toLocaleString('zh-CN');
    statusEl.textContent = `${message} | ${now}`;
}

/**
 * 更新时间显示
 */
function updateTime() {
    const timeEl = document.getElementById('currentTime');
    const now = new Date();
    timeEl.textContent = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * 显示Toast提示
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 窗口控制按钮
 */
document.querySelector('.win-btn.minimize').addEventListener('click', () => {
    showToast('最小化功能需要Electron支持', 'info');
});

document.querySelector('.win-btn.maximize').addEventListener('click', () => {
    showToast('最大化功能需要Electron支持', 'info');
});

document.querySelector('.win-btn.close').addEventListener('click', () => {
    if (confirm('确定要退出系统吗？')) {
        window.close();
    }
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (AppState.refreshInterval) {
        clearInterval(AppState.refreshInterval);
    }
});
