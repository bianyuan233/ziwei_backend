// 数据库配置示例 (PostgreSQL)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'miniprogram_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
};

// 如果您使用其他数据库，请相应修改配置
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'miniprogram_db',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
};

module.exports = {
  dbConfig,
  mysqlConfig
};