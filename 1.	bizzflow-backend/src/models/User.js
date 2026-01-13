const { query } = require('../config/database');
const { hashPassword, comparePassword } = require('../config/auth');

const User = {
  // Criar usuário
  async create(userData) {
    const { name, email, password, role = 'user' } = userData;
    const hashedPassword = await hashPassword(password);
    
    const sql = `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `;
    
    return await query(sql, [name, email, hashedPassword, role]);
  },

  // Buscar por email
  async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await query(sql, [email]);
    return result.rows[0];
  },

  // Buscar por ID
  async findById(id) {
    const sql = 'SELECT id, name, email, role, created_at FROM users WHERE id = $1 AND is_active = true';
    const result = await query(sql, [id]);
    return result.rows[0];
  },

  // Atualizar último login
  async updateLastLogin(id) {
    const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await query(sql, [id]);
  },

  // Listar todos usuários (apenas admin)
  async findAll(limit = 50, offset = 0) {
    const sql = `
      SELECT id, name, email, role, created_at, last_login
      FROM users 
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    return await query(sql, [limit, offset]);
  },

  // Atualizar usuário
  async update(id, userData) {
    const { name, email, role } = userData;
    const sql = `
      UPDATE users 
      SET name = $1, email = $2, role = $3
      WHERE id = $4
      RETURNING id, name, email, role
    `;
    return await query(sql, [name, email, role, id]);
  },

  // Desativar usuário
  async deactivate(id) {
    const sql = 'UPDATE users SET is_active = false WHERE id = $1';
    await query(sql, [id]);
  },

  // Validar credenciais
  async validateCredentials(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    
    const isValid = await comparePassword(password, user.password);
    return isValid ? user : null;
  }
};

module.exports = User;
