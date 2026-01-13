const { query } = require('../config/database');

const Product = {
  // Criar produto
  async create(productData) {
    const {
      code, name, description, category,
      unit_price, cost_price, stock, min_stock, supplier
    } = productData;
    
    const sql = `
      INSERT INTO products 
      (code, name, description, category, unit_price, cost_price, stock, min_stock, supplier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    return await query(sql, [
      code, name, description, category, unit_price, cost_price, stock, min_stock, supplier
    ]);
  },

  // Buscar por ID
  async findById(id) {
    const sql = 'SELECT * FROM products WHERE id = $1 AND is_active = true';
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  // Buscar por código
  async findByCode(code) {
    const sql = 'SELECT * FROM products WHERE code = $1 AND is_active = true';
    const result = await query(sql, [code]);
    return result.rows[0];
  },

  // Listar todos produtos
  async findAll(filters = {}, limit = 100, offset = 0) {
    let sql = 'SELECT * FROM products WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (filters.category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.search) {
      sql += ` AND (
        name ILIKE $${paramIndex} OR 
        code ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.low_stock) {
      sql += ` AND stock <= min_stock`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return await query(sql, params);
  },

  // Atualizar produto
  async update(id, productData) {
    const {
      name, description, category, unit_price,
      cost_price, stock, min_stock, supplier
    } = productData;
    
    const sql = `
      UPDATE products 
      SET name = $1, description = $2, category = $3, 
          unit_price = $4, cost_price = $5, stock = $6, 
          min_stock = $7, supplier = $8
      WHERE id = $9
      RETURNING *
    `;
    
    return await query(sql, [
      name, description, category, unit_price,
      cost_price, stock, min_stock, supplier, id
    ]);
  },

  // Atualizar estoque
  async updateStock(id, quantity) {
    const sql = `
      UPDATE products 
      SET stock = stock + $1
      WHERE id = $2
      RETURNING stock
    `;
    
    return await query(sql, [quantity, id]);
  },

  // Deletar produto (soft delete)
  async delete(id) {
    const sql = 'UPDATE products SET is_active = false WHERE id = $1';
    return await query(sql, [id]);
  },

  // Estatísticas
  async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END) as low_stock_count,
        COUNT(DISTINCT category) as categories_count,
        COALESCE(SUM(stock * unit_price), 0) as total_inventory_value
      FROM products
      WHERE is_active = true
    `;
    const result = await query(sql);
    return result.rows[0];
  }
};

module.exports = Product;
