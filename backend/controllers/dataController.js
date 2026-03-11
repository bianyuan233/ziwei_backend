const dataService = require('../services/dataService');

class DataController {
  // 获取所有数据
  async getAllData(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const result = await dataService.getAllData(page, limit);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: '获取数据失败',
        message: error.message
      });
    }
  }

  // 获取特定ID的数据
  async getDataById(req, res) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: '无效的ID参数'
        });
      }
      
      const item = await dataService.getDataById(id);
      
      if (!item) {
        return res.status(404).json({
          error: '未找到指定数据'
        });
      }
      
      res.json(item);
    } catch (error) {
      res.status(500).json({
        error: '获取数据失败',
        message: error.message
      });
    }
  }

  // 创建数据
  async createData(req, res) {
    try {
      const { name, value } = req.body;
      
      if (!name || !value) {
        return res.status(400).json({
          error: '缺少必需字段 name 或 value'
        });
      }
      
      const newItem = await dataService.createData({ name, value });
      
      res.status(201).json({
        success: true,
        data: newItem,
        message: '数据创建成功'
      });
    } catch (error) {
      res.status(500).json({
        error: '创建数据失败',
        message: error.message
      });
    }
  }

  // 更新数据
  async updateData(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { name, value } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: '无效的ID参数'
        });
      }
      
      const updatedItem = await dataService.updateData(id, { name, value });
      
      if (!updatedItem) {
        return res.status(404).json({
          error: '未找到要更新的数据'
        });
      }
      
      res.json({
        success: true,
        data: updatedItem,
        message: '数据更新成功'
      });
    } catch (error) {
      res.status(500).json({
        error: '更新数据失败',
        message: error.message
      });
    }
  }

  // 删除数据
  async deleteData(req, res) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          error: '无效的ID参数'
        });
      }
      
      const deletedItem = await dataService.deleteData(id);
      
      if (!deletedItem) {
        return res.status(404).json({
          error: '未找到要删除的数据'
        });
      }
      
      res.json({
        success: true,
        message: `ID为 ${id} 的数据已删除`
      });
    } catch (error) {
      res.status(500).json({
        error: '删除数据失败',
        message: error.message
      });
    }
  }
}

module.exports = new DataController();