# 小程序后端API服务

这是一个为小程序设计的后端API服务，提供了RESTful接口供小程序调用。

## 功能特性

- RESTful API 设计
- 支持 CRUD 操作（创建、读取、更新、删除）
- 数据分页功能
- 完整的错误处理机制
- 安全性中间件（helmet）
- 请求日志记录（morgan）
- CORS 支持

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## API 接口说明

### 1. 健康检查

- **URL**: `/api/health`
- **方法**: `GET`
- **参数**: 无
- **返回**: 服务器健康状态和时间戳

### 2. 获取所有数据

- **URL**: `/api/data`
- **方法**: `GET`
- **参数**:
  - `page` (可选): 页码，默认为 1
  - `limit` (可选): 每页数量，默认为 10
- **返回**: 分页数据列表

### 3. 获取特定数据

- **URL**: `/api/data/:id`
- **方法**: `GET`
- **参数**: 
  - `id`: 数据ID
- **返回**: 单条数据信息

### 4. 创建数据

- **URL**: `/api/data`
- **方法**: `POST`
- **请求体**:
  - `name`: 数据名称（必填）
  - `value`: 数据值（必填）
- **返回**: 创建成功的数据

### 5. 更新数据

- **URL**: `/api/data/:id`
- **方法**: `PUT`
- **参数**: 
  - `id`: 数据ID
- **请求体**:
  - `name`: 数据名称（可选）
  - `value`: 数据值（可选）
- **返回**: 更新后的数据

### 6. 删除数据

- **URL**: `/api/data/:id`
- **方法**: `DELETE`
- **参数**: 
  - `id`: 数据ID
- **返回**: 删除结果信息

## 小程序调用示例

```javascript
// 获取数据列表
wx.request({
  url: 'http://localhost:3000/api/data?page=1&limit=10',
  method: 'GET',
  success: function(res) {
    console.log(res.data);
  }
});

// 创建数据
wx.request({
  url: 'http://localhost:3000/api/data',
  method: 'POST',
  data: {
    name: '测试数据',
    value: 'test_value'
  },
  success: function(res) {
    console.log(res.data);
  }
});
```

## 环境变量配置

在 `.env` 文件中可以配置以下环境变量：

- `PORT`: 服务端口号（默认 3000）
- `NODE_ENV`: 运行环境（默认 development）

## 目录结构

```
backend/
├── server.js           # 主服务器文件
├── .env               # 环境变量配置
├── routes/
│   └── api.js         # API路由定义
├── controllers/
│   └── dataController.js # 控制器逻辑
├── services/
│   └── dataService.js # 业务逻辑服务
└── config/
    └── database.js    # 数据库配置
```

## 扩展建议

1. 集成真实数据库（如 MongoDB, PostgreSQL, MySQL）
2. 添加用户认证和授权功能
3. 实现数据验证中间件
4. 添加缓存机制提升性能
5. 集成单元测试和集成测试