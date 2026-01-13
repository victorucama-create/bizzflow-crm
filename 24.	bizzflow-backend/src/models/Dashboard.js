const { query } = require('../config/database');

const Dashboard = {
  // Métricas principais
  async getMainMetrics() {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE) as sales_today,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE DATE(sale_date) = CURRENT_DATE) as revenue_today,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
        (SELECT COUNT(*) FROM products WHERE stock <= min_stock AND is_active = true) as low_stock_items,
        (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE - INTERVAL '1 day') as sales_yesterday
    `;
    
    const result = await query(sql);
    return result.rows[0];
  },

  // Vendas por período
  async getSalesByPeriod(period = '7days') {
    let interval = '';
    
    switch (period) {
      case '7days':
        interval = '7 DAY';
        break;
      case '30days':
        interval = '30 DAY';
        break;
      case '90days':
        interval = '90 DAY';
        break;
      default:
        interval = '7 DAY';
    }

    const sql = `
      SELECT 
        DATE(sale_date) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(final_amount), 0) as revenue
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY DATE(sale_date)
      ORDER BY date ASC
    `;

    return await query(sql);
  },

  // Produtos mais vendidos
  async getTopProducts(limit = 10) {
    const sql = `
      SELECT 
        p.name,
        p.code,
        p.category,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= CURRENT_DATE - INTERVAL '30 DAY'
      GROUP BY p.id, p.name, p.code, p.category
      ORDER BY total_quantity DESC
      LIMIT $1
    `;

    return await query(sql, [limit]);
  },

  // Clientes que mais compram
  async getTopClients(limit = 10) {
    const sql = `
      SELECT 
        c.name,
        c.email,
        c.category,
        COUNT(s.id) as purchase_count,
        COALESCE(SUM(s.final_amount), 0) as total_spent
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id
      WHERE s.sale_date >= CURRENT_DATE - INTERVAL '90 DAY'
      GROUP BY c.id, c.name, c.email, c.category
      ORDER BY total_spent DESC NULLS LAST
      LIMIT $1
    `;

    return await query(sql, [limit]);
  },

  // Métricas por categoria
  async getCategoryMetrics() {
    const sql = `
      SELECT 
        p.category,
        COUNT(*) as product_count,
        SUM(p.stock) as total_stock,
        COALESCE(SUM(p.stock * p.unit_price), 0) as inventory_value,
        COALESCE(SUM(si.quantity), 0) as sold_quantity,
        COALESCE(SUM(si.total_price), 0) as sales_revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.sale_date >= CURRENT_DATE - INTERVAL '30 DAY'
      WHERE p.is_active = true
      GROUP BY p.category
      ORDER BY sales_revenue DESC
    `;

    return await query(sql);
  }
};

module.exports = Dashboard;
