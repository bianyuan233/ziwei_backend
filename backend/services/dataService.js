// 数据服务层
class DataService {
  constructor() {
    // 这里可以初始化数据库连接或其他资源
    this.dataStore = [
      { id: 1, name: '纸虎剧场欢迎你', value: 'value1', createdAt: new Date() },
      { id: 2, name: '纸虎剧场欢迎你', value: 'value2', createdAt: new Date() },
      { id: 3, name: '纸虎剧场欢迎你', value: 'value3', createdAt: new Date() }
    ];
  }

  // 获取所有数据
  async getAllData(page = 1, limit = 10) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    return {
      items: this.dataStore.slice(startIndex, endIndex),
      total: this.dataStore.length,
      page: parseInt(page),
      totalPages: Math.ceil(this.dataStore.length / limit)
    };
  }

  // 根据ID获取数据
  async getDataById(id) {
    return this.dataStore.find(item => item.id === parseInt(id));
  }

  // 创建新数据
  async createData(data) {
    const newItem = {
      id: this.dataStore.length > 0 ? Math.max(...this.dataStore.map(item => item.id)) + 1 : 1,
      ...data,
      createdAt: new Date()
    };
    
    this.dataStore.push(newItem);
    return newItem;
  }

  // 更新数据
  async updateData(id, data) {
    const index = this.dataStore.findIndex(item => item.id === parseInt(id));
    
    if (index !== -1) {
      this.dataStore[index] = {
        ...this.dataStore[index],
        ...data,
        updatedAt: new Date()
      };
      
      return this.dataStore[index];
    }
    
    return null;
  }

  // 删除数据
  async deleteData(id) {
    const index = this.dataStore.findIndex(item => item.id === parseInt(id));
    
    if (index !== -1) {
      const deletedItem = this.dataStore.splice(index, 1)[0];
      return deletedItem;
    }
    
    return null;
  }
}

module.exports = new DataService();