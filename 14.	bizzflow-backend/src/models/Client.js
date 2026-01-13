const { query } = require('../config/database');

const Client = {
  // Criar cliente
  async create(clientData, userId) {
    const { 
      name, email, phone, address, city, province, category 
    } = clientData;
    
    const sql = `
      INSERT INTO clients 
      (name, email, phone, address, city, province, category, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    return await query(sql, [
      name, email, phone, address, city, province, category, userId
    ]);
  },

  // Buscar por ID
  async findById(id) {
    const sql = `
      SELECT c.*, u.name as created_by_name
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  // Listar todos clientes
  async findAll(filters = {}, limit = 100, offset = 0) {
    let sql = `
      SELECT c.*, u.name as created_by_name
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filtros
    if (filters.category) {
      sql += ` AND c.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.search) {
      sql += ` AND (
        c.name ILIKE $${paramIndex} OR 
        c.email ILIKE $${paramIndex} OR 
        c.phone ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return await query(sql, params);
  },

  // Atualizar cliente
  async update(id, clientData) {
    const { 
      name, email, phone, address, city, province, category 
    } = clientData;
    
    const sql = `
      UPDATE clients 
      SET name = $1, email = $2, phone = $3, 
          address = $4, city = $5, province = $6, category = $7
      WHERE id = $8
      RETURNING *
    `;
    
    return await query(sql, [
      name, email, phone, address, city, province, category, id
    ]);
  },

  // Deletar cliente
  async delete(id) {
    const sql = 'DELETE FROM clients WHERE id = $1';
    return await query(sql, [id]);
  },

  // Estatísticas
  async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN category = 'VIP' THEN 1 END) as vip_count,
        COUNT(CASE WHEN category = 'corporate' THEN 1 END) as corporate_count,
        COALESCE(SUM(total_spent), 0) as total_revenue
      FROM clients
    `;
    const result = await query(sql);
    return result.rows[0];
  },

  // Buscar por email
  async findByEmail(email) {
    const sql = 'SELECT * FROM clients WHERE email = $1';
    const result = await query(sql, [email]);
    return result.rows[0];
  }
};

module.exports = Client;
