const { query } = require('../config/database');

const SaleItem = {
  // Criar item de venda
  async create(saleId, itemData) {
    const { product_id, quantity, unit_price } = itemData;
    const total_price = unit_price * quantity;
    
    const sql = `
      INSERT INTO sale_items 
      (sale_id, product_id, quantity, unit_price, total_price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    return await query(sql, [saleId, product_id, quantity, unit_price, total_price]);
  },

  // Buscar itens por venda
  async findBySaleId(saleId) {
    const sql = `
      SELECT 
        si.*,
        p.name as product_name,
        p.code as product_code,
        p.category as product_category,
        p.unit_price as product_current_price
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
      ORDER BY si.id
    `;
    
    const result = await query(sql, [saleId]);
    return result.rows;
  },

  // Buscar item por ID
  async findById(id) {
    const sql = `
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.id = $1
    `;
    
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  // Atualizar item
  async update(id, itemData) {
    const { quantity, unit_price } = itemData;
    const total_price = unit_price * quantity;
    
    const sql = `
      UPDATE sale_items 
      SET quantity = $1, unit_price = $2, total_price = $3
      WHERE id = $4
      RETURNING *
    `;
    
    return await query(sql, [quantity, unit_price, total_price, id]);
  },

  // Deletar item
  async delete(id) {
    const sql = 'DELETE FROM sale_items WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  // Deletar todos itens de uma venda
  async deleteBySaleId(saleId) {
    const sql = 'DELETE FROM sale_items WHERE sale_id = $1';
    await query(sql, [saleId]);
  },

  // Estatísticas de produtos vendidos
  async getProductStats(productId, startDate, endDate) {
    let sql = `
      SELECT 
        SUM(quantity) as total_quantity,
        SUM(total_price) as total_revenue,
        COUNT(DISTINCT sale_id) as sale_count,
        AVG(unit_price) as avg_price
      FROM sale_items
      WHERE product_id = $1
    `;
    
    const params = [productId];
    
    if (startDate && endDate) {
      sql += ` AND sale_id IN (
        SELECT id FROM sales 
        WHERE sale_date BETWEEN $2 AND $3
      )`;
      params.push(startDate, endDate);
    }
    
    const result = await query(sql, params);
    return result.rows[0];
  },

  // Relatório de vendas por produto
  async getSalesByProductReport(filters = {}) {
    let sql = `
      SELECT 
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        p.category as product_category,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_sale_price,
        p.unit_price as current_price,
        p.stock as current_stock,
        COUNT(DISTINCT si.sale_id) as sale_count
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Filtros de data
    if (filters.start_date && filters.end_date) {
      sql += ` AND s.sale_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(filters.start_date, filters.end_date);
      paramIndex += 2;
    }
    
    // Filtro por categoria
    if (filters.category) {
      sql += ` AND p.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }
    
    sql += `
      GROUP BY p.id, p.code, p.name, p.category, p.unit_price, p.stock
      ORDER BY total_revenue DESC
    `;
    
    // Limite de resultados
    if (filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }
    
    const result = await query(sql, params);
    return result.rows;
  },

  // Verificar se produto foi vendido
  async isProductSold(productId) {
    const sql = `
      SELECT EXISTS(
        SELECT 1 FROM sale_items 
        WHERE product_id = $1
        LIMIT 1
      ) as is_sold
    `;
    
    const result = await query(sql, [productId]);
    return result.rows[0].is_sold;
  }
};

module.exports = SaleItem;
