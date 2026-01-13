const Dashboard = require('../models/Dashboard');

const dashboardController = {
  // Métricas principais do dashboard
  async getMainMetrics(req, res) {
    try {
      const metrics = await Dashboard.getMainMetrics();
      
      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar métricas do dashboard.'
      });
    }
  },

  // Vendas por período (para gráficos)
  async getSalesByPeriod(req, res) {
    try {
      const { period = '7days' } = req.query;
      const result = await Dashboard.getSalesByPeriod(period);
      
      res.json({
        success: true,
        period,
        data: result.rows
      });

    } catch (error) {
      console.error('Get sales by period error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar dados de vendas.'
      });
    }
  },

  // Produtos mais vendidos
  async getTopProducts(req, res) {
    try {
      const { limit = 10 } = req.query;
      const result = await Dashboard.getTopProducts(parseInt(limit));
      
      res.json({
        success: true,
        products: result.rows
      });

    } catch (error) {
      console.error('Get top products error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar produtos mais vendidos.'
      });
    }
  },

  // Clientes que mais compram
  async getTopClients(req, res) {
    try {
      const { limit = 10 } = req.query;
      const result = await Dashboard.getTopClients(parseInt(limit));
      
      res.json({
        success: true,
        clients: result.rows
      });

    } catch (error) {
      console.error('Get top clients error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar clientes que mais compram.'
      });
    }
  },

  // Métricas por categoria
  async getCategoryMetrics(req, res) {
    try {
      const result = await Dashboard.getCategoryMetrics();
      
      res.json({
        success: true,
        categories: result.rows
      });

    } catch (error) {
      console.error('Get category metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar métricas por categoria.'
      });
    }
  }
};

module.exports = dashboardController;
