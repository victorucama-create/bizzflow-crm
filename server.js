// ==============================================
// BIZZFLOW CRM v3.0 - SERVER COMPLETO
// ==============================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ==============================================
// CONFIGURAÇÃO
// ==============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(cors({
  origin: ['https://bizzflow-crm.onrender.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Headers de segurança
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido.'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado.'
    });
  }
};

// ==============================================
// ROTAS PÚBLICAS
// ==============================================

// Health Check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'BizzFlow CRM API',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'BizzFlow CRM API',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Status do sistema
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'BizzFlow CRM',
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/*',
      clients: '/api/clients/*',
      products: '/api/products/*',
      sales: '/api/sales/*',
      dashboard: '/api/dashboard/*',
      reports: '/api/reports/*'
    }
  });
});

// ==============================================
// API - AUTENTICAÇÃO
// ==============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios.'
      });
    }

    // Buscar usuário
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }
    
    const user = result.rows[0];
    
    // Verificar senha
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    // Gerar token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '7d' }
    );

    // Atualizar último login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Remover senha da resposta
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      message: 'Login realizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar login.'
    });
  }
});

// Perfil do usuário
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at, last_login FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil.'
    });
  }
});

// ==============================================
// API - CLIENTES (CRUD COMPLETO)
// ==============================================

// Listar clientes
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { 
      search = '', 
      category = '',
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      clients: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes.'
    });
  }
});

// Buscar cliente por ID
app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado.'
      });
    }
    
    res.json({
      success: true,
      client: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar cliente.'
    });
  }
});

// Criar cliente
app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, city, province, category } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nome é obrigatório.'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, province, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, email || null, phone || null, address || null, city || null, province || null, category || 'normal']
    );
    
    res.status(201).json({
      success: true,
      client: result.rows[0],
      message: 'Cliente criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create client error:', error);
    
    // Verificar se é erro de duplicação de email
    if (error.code === '23505' && error.constraint === 'clients_email_key') {
      return res.status(400).json({
        success: false,
        message: 'Este email já está cadastrado.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente.'
    });
  }
});

// Atualizar cliente
app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, province, category } = req.body;
    
    // Verificar se cliente existe
    const clientExists = await pool.query(
      'SELECT id FROM clients WHERE id = $1',
      [id]
    );
    
    if (clientExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado.'
      });
    }
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nome é obrigatório.'
      });
    }
    
    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, email = $2, phone = $3, address = $4, 
           city = $5, province = $6, category = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, email || null, phone || null, address || null, 
       city || null, province || null, category || 'normal', id]
    );
    
    res.json({
      success: true,
      client: result.rows[0],
      message: 'Cliente atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update client error:', error);
    
    if (error.code === '23505' && error.constraint === 'clients_email_key') {
      return res.status(400).json({
        success: false,
        message: 'Este email já está cadastrado para outro cliente.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar cliente.'
    });
  }
});

// Deletar cliente
app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se cliente existe
    const clientExists = await pool.query(
      'SELECT id, name FROM clients WHERE id = $1',
      [id]
    );
    
    if (clientExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado.'
      });
    }
    
    // Verificar se cliente tem vendas
    const hasSales = await pool.query(
      'SELECT COUNT(*) FROM sales WHERE client_id = $1',
      [id]
    );
    
    if (parseInt(hasSales.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir cliente com vendas associadas.'
      });
    }
    
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Cliente excluído com sucesso!'
    });
    
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir cliente.'
    });
  }
});

// Estatísticas de clientes
app.get('/api/clients/stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN category = 'VIP' THEN 1 END) as vip_count,
        COUNT(CASE WHEN category = 'corporate' THEN 1 END) as corporate_count,
        COALESCE(SUM(total_spent), 0) as total_revenue,
        COUNT(CASE WHEN last_purchase >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_clients
      FROM clients
    `);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
    
  } catch (error) {
    console.error('Client stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas.'
    });
  }
});

// ==============================================
// API - PRODUTOS (CRUD COMPLETO)
// ==============================================

// Listar produtos
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { 
      search = '', 
      category = '',
      low_stock = false,
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (low_stock === 'true') {
      query += ` AND stock <= min_stock`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      products: result.rows,
      total: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos.'
    });
  }
});

// Buscar produto por ID
app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }
    
    res.json({
      success: true,
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produto.'
    });
  }
});

// Buscar produto por código
app.get('/api/products/code/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE code = $1 AND is_active = true',
      [code.toUpperCase()]
    );
    
    res.json({
      success: true,
      product: result.rows[0] || null
    });
    
  } catch (error) {
    console.error('Get product by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produto.'
    });
  }
});

// Criar produto
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { code, name, description, category, unit_price, cost_price, stock, min_stock, supplier } = req.body;
    
    if (!code || !name || !unit_price) {
      return res.status(400).json({
        success: false,
        message: 'Código, nome e preço são obrigatórios.'
      });
    }
    
    if (unit_price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Preço unitário não pode ser negativo.'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO products (code, name, description, category, unit_price, cost_price, stock, min_stock, supplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        code.toUpperCase(), 
        name, 
        description || null, 
        category || null,
        parseFloat(unit_price),
        cost_price ? parseFloat(cost_price) : null,
        stock ? parseInt(stock) : 0,
        min_stock ? parseInt(min_stock) : 10,
        supplier || null
      ]
    );
    
    res.status(201).json({
      success: true,
      product: result.rows[0],
      message: 'Produto criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create product error:', error);
    
    if (error.code === '23505' && error.constraint === 'products_code_key') {
      return res.status(400).json({
        success: false,
        message: 'Este código de produto já está cadastrado.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao criar produto.'
    });
  }
});

// Atualizar produto
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, unit_price, cost_price, stock, min_stock, supplier } = req.body;
    
    // Verificar se produto existe
    const productExists = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }
    
    if (!name || !unit_price) {
      return res.status(400).json({
        success: false,
        message: 'Nome e preço são obrigatórios.'
      });
    }
    
    if (unit_price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Preço unitário não pode ser negativo.'
      });
    }
    
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, description = $2, category = $3, unit_price = $4,
           cost_price = $5, stock = $6, min_stock = $7, supplier = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        name,
        description || null,
        category || null,
        parseFloat(unit_price),
        cost_price ? parseFloat(cost_price) : null,
        stock ? parseInt(stock) : 0,
        min_stock ? parseInt(min_stock) : 10,
        supplier || null,
        id
      ]
    );
    
    res.json({
      success: true,
      product: result.rows[0],
      message: 'Produto atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar produto.'
    });
  }
});

// Atualizar estoque do produto
app.patch('/api/products/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, action = 'add' } = req.body;
    
    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Quantidade inválida.'
      });
    }
    
    const qty = parseInt(quantity);
    
    let query;
    if (action === 'add') {
      query = 'UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *';
    } else if (action === 'subtract') {
      query = 'UPDATE products SET stock = stock - $1 WHERE id = $2 RETURNING *';
    } else if (action === 'set') {
      query = 'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Ação inválida. Use: add, subtract ou set.'
      });
    }
    
    const result = await pool.query(query, [qty, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }
    
    res.json({
      success: true,
      product: result.rows[0],
      message: `Estoque ${action === 'add' ? 'adicionado' : action === 'subtract' ? 'subtraído' : 'definido'} com sucesso!`
    });
    
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar estoque.'
    });
  }
});

// Deletar produto (soft delete)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se produto existe
    const productExists = await pool.query(
      'SELECT id, name FROM products WHERE id = $1',
      [id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }
    
    // Verificar se produto está em vendas
    const inSales = await pool.query(
      'SELECT COUNT(*) FROM sale_items WHERE product_id = $1',
      [id]
    );
    
    if (parseInt(inSales.rows[0].count) > 0) {
      // Soft delete
      await pool.query(
        'UPDATE products SET is_active = false WHERE id = $1',
        [id]
      );
      
      return res.json({
        success: true,
        message: 'Produto desativado (está em vendas históricas).'
      });
    }
    
    // Hard delete
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Produto excluído com sucesso!'
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir produto.'
    });
  }
});

// Estatísticas de produtos
app.get('/api/products/stats', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END) as low_stock_count,
        COUNT(DISTINCT category) as categories_count,
        COALESCE(SUM(stock * unit_price), 0) as inventory_value,
        COALESCE(AVG(unit_price), 0) as avg_price
      FROM products
      WHERE is_active = true
    `);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
    
  } catch (error) {
    console.error('Product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas.'
    });
  }
});

// ==============================================
// API - VENDAS (CRUD COMPLETO)
// ==============================================

// Listar vendas
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date = '',
      end_date = '',
      client_id = '',
      period = '',
      limit = 50, 
      offset = 0 
    } = req.query;
    
    let query = `
      SELECT s.*, c.name as client_name 
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    // Filtros de data
    if (start_date && end_date) {
      query += ` AND s.sale_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    } else if (period === 'today') {
      query += ` AND DATE(s.sale_date) = CURRENT_DATE`;
    } else if (period === 'week') {
      query += ` AND s.sale_date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      query += ` AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    if (client_id) {
      query += ` AND s.client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Buscar contagem total para paginação
    const countQuery = query.replace(/SELECT s\.\*, c\.name as client_name/, 'SELECT COUNT(*)')
                           .replace(/ORDER BY.*$/, '');
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      success: true,
      sales: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar vendas.'
    });
  }
});

// Buscar venda por ID
app.get('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar venda
    const saleResult = await pool.query(
      `SELECT s.*, c.name as client_name 
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada.'
      });
    }
    
    // Buscar itens da venda
    const itemsResult = await pool.query(
      `SELECT si.*, p.name as product_name, p.code as product_code
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1
       ORDER BY si.id`,
      [id]
    );
    
    const sale = saleResult.rows[0];
    sale.items = itemsResult.rows;
    
    res.json({
      success: true,
      sale
    });
    
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar venda.'
    });
  }
});

// Criar venda
app.post('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { client_id, items, discount = 0, tax = 0, payment_method = 'cash', notes = '' } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário pelo menos um item para a venda.'
      });
    }
    
    // Validar itens
    let subtotal = 0;
    for (const item of items) {
      const productResult = await pool.query(
        'SELECT id, unit_price, stock, name FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Produto ID ${item.product_id} não encontrado.`
        });
      }
      
      const product = productResult.rows[0];
      
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}`
        });
      }
      
      subtotal += product.unit_price * item.quantity;
    }
    
    const total_amount = subtotal;
    const final_amount = subtotal - discount + tax;
    
    // Gerar número da venda
    const date = new Date();
    const saleNumber = `V${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // Iniciar transação
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Inserir venda
      const saleResult = await client.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [saleNumber, client_id || null, total_amount, discount, tax, final_amount, payment_method, notes || null]
      );
      
      const sale = saleResult.rows[0];
      
      // Inserir itens e atualizar estoque
      for (const item of items) {
        const product = await client.query(
          'SELECT unit_price FROM products WHERE id = $1',
          [item.product_id]
        );
        
        const unitPrice = product.rows[0].unit_price;
        
        // Inserir item
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [sale.id, item.product_id, item.quantity, unitPrice, unitPrice * item.quantity]
        );
        
        // Atualizar estoque
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
      
      // Atualizar cliente (se tiver)
      if (client_id) {
        await client.query(
          `UPDATE clients 
           SET total_spent = total_spent + $1, last_purchase = CURRENT_DATE
           WHERE id = $2`,
          [final_amount, client_id]
        );
      }
      
      await client.query('COMMIT');
      
      // Buscar venda completa para retornar
      const completeSaleResult = await pool.query(
        `SELECT s.*, c.name as client_name 
         FROM sales s
         LEFT JOIN clients c ON s.client_id = c.id
         WHERE s.id = $1`,
        [sale.id]
      );
      
      const itemsResult = await pool.query(
        `SELECT si.*, p.name as product_name, p.code as product_code
         FROM sale_items si
         LEFT JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      
      const completeSale = completeSaleResult.rows[0];
      completeSale.items = itemsResult.rows;
      
      res.status(201).json({
        success: true,
        sale: completeSale,
        message: 'Venda realizada com sucesso!'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar venda.'
    });
  }
});

// Deletar venda
app.delete('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se venda existe
    const saleExists = await pool.query(
      'SELECT id, sale_number FROM sales WHERE id = $1',
      [id]
    );
    
    if (saleExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada.'
      });
    }
    
    // Iniciar transação para reverter estoque
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Buscar itens para reverter estoque
      const itemsResult = await client.query(
        'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
        [id]
      );
      
      // Reverter estoque
      for (const item of itemsResult.rows) {
        await client.query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
      
      // Reverter total gasto do cliente (se tiver)
      const sale = await client.query(
        'SELECT client_id, final_amount FROM sales WHERE id = $1',
        [id]
      );
      
      if (sale.rows[0].client_id) {
        await client.query(
          `UPDATE clients 
           SET total_spent = total_spent - $1
           WHERE id = $2`,
          [sale.rows[0].final_amount, sale.rows[0].client_id]
        );
      }
      
      // Deletar itens e venda
      await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
      await client.query('DELETE FROM sales WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Venda excluída com sucesso!'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir venda.'
    });
  }
});

// Estatísticas de vendas
app.get('/api/sales/stats', authenticateToken, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'AND DATE(sale_date) = CURRENT_DATE';
        break;
      case 'week':
        dateFilter = 'AND sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'AND sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'year':
        dateFilter = 'AND sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_value,
        COUNT(DISTINCT client_id) as unique_clients,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN final_amount ELSE 0 END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN final_amount ELSE 0 END), 0) as transfer_total
      FROM sales
      WHERE 1=1 ${dateFilter}
    `);
    
    res.json({
      success: true,
      stats: result.rows[0],
      period
    });
    
  } catch (error) {
    console.error('Sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas.'
    });
  }
});

// ==============================================
// API - DASHBOARD (COMPLETO)
// ==============================================

// Métricas principais
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const [
      salesToday, 
      revenueToday, 
      totalClients, 
      totalProducts, 
      lowStock,
      salesYesterday,
      topProducts,
      recentSales
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM clients"),
      pool.query("SELECT COUNT(*) FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM products WHERE stock <= min_stock AND is_active = true"),
      pool.query("SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE - INTERVAL '1 day'"),
      pool.query(`
        SELECT p.name, p.code, SUM(si.quantity) as total_quantity
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.sale_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY p.id, p.name, p.code
        ORDER BY total_quantity DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT s.sale_number, s.final_amount, c.name as client_name, s.sale_date
        FROM sales s
        LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY s.created_at DESC
        LIMIT 5
      `)
    ]);
    
    res.json({
      success: true,
      metrics: {
        sales_today: parseInt(salesToday.rows[0].count),
        revenue_today: parseFloat(revenueToday.rows[0].coalesce),
        total_clients: parseInt(totalClients.rows[0].count),
        total_products: parseInt(totalProducts.rows[0].count),
        low_stock_items: parseInt(lowStock.rows[0].count),
        sales_yesterday: parseInt(salesYesterday.rows[0].count),
        growth_percentage: calculateGrowth(
          parseInt(salesToday.rows[0].count),
          parseInt(salesYesterday.rows[0].count)
        )
      },
      top_products: topProducts.rows,
      recent_sales: recentSales.rows
    });
    
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas.'
    });
  }
});

// Vendas por período (para gráficos)
app.get('/api/dashboard/sales-chart', authenticateToken, async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    let interval = '7 DAY';
    switch (period) {
      case '30days': interval = '30 DAY'; break;
      case '90days': interval = '90 DAY'; break;
      case 'year': interval = '365 DAY'; break;
    }
    
    const result = await pool.query(`
      SELECT 
        DATE(sale_date) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(final_amount), 0) as revenue
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY DATE(sale_date)
      ORDER BY date ASC
    `);
    
    res.json({
      success: true,
      period,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Sales chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados para gráfico.'
    });
  }
});

// Clientes que mais compram
app.get('/api/dashboard/top-clients', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        c.name,
        c.email,
        c.category,
        COUNT(s.id) as purchase_count,
        COALESCE(SUM(s.final_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id
      WHERE s.id IS NOT NULL
      GROUP BY c.id, c.name, c.email, c.category
      ORDER BY total_spent DESC
      LIMIT $1
    `, [parseInt(limit)]);
    
    res.json({
      success: true,
      clients: result.rows
    });
    
  } catch (error) {
    console.error('Top clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes.'
    });
  }
});

// ==============================================
// API - RELATÓRIOS (NOVO)
// ==============================================

// Relatório de vendas detalhado
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date,
      end_date,
      client_id,
      group_by = 'day'
    } = req.query;
    
    let query = `
      SELECT 
        ${group_by === 'day' ? 'DATE(s.sale_date) as period' : 
          group_by === 'month' ? 'TO_CHAR(s.sale_date, \'YYYY-MM\') as period' :
          group_by === 'year' ? 'EXTRACT(YEAR FROM s.sale_date) as period' : 'DATE(s.sale_date) as period'},
        COUNT(*) as sales_count,
        COUNT(DISTINCT s.client_id) as unique_clients,
        COALESCE(SUM(s.final_amount), 0) as total_revenue,
        COALESCE(AVG(s.final_amount), 0) as avg_sale_value,
        COALESCE(SUM(s.discount), 0) as total_discount
      FROM sales s
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date && end_date) {
      query += ` AND s.sale_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }
    
    if (client_id) {
      query += ` AND s.client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    query += ` GROUP BY ${group_by === 'day' ? 'DATE(s.sale_date)' : 
              group_by === 'month' ? 'TO_CHAR(s.sale_date, \'YYYY-MM\')' :
              group_by === 'year' ? 'EXTRACT(YEAR FROM s.sale_date)' : 'DATE(s.sale_date)'}
              ORDER BY period`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas adicionais
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_value,
        MIN(sale_date) as first_sale,
        MAX(sale_date) as last_sale
      FROM sales
      WHERE 1=1
      ${start_date && end_date ? `AND sale_date BETWEEN '${start_date}' AND '${end_date}'` : ''}
      ${client_id ? `AND client_id = ${client_id}` : ''}
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    res.json({
      success: true,
      report: {
        period: {
          start: start_date || 'Início',
          end: end_date || 'Hoje'
        },
        data: result.rows,
        summary: statsResult.rows[0],
        group_by: group_by
      }
    });
    
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório de vendas.'
    });
  }
});

// Relatório de produtos
app.get('/api/reports/products', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date,
      end_date,
      category,
      low_stock_only = false
    } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.category,
        p.unit_price,
        p.stock,
        p.min_stock,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        CASE 
          WHEN p.stock <= p.min_stock THEN 'BAIXO'
          WHEN p.stock <= p.min_stock * 2 THEN 'ALERTA'
          ELSE 'NORMAL'
        END as stock_status
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE p.is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date && end_date) {
      query += ` AND s.sale_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }
    
    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (low_stock_only === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    query += ` GROUP BY p.id, p.code, p.name, p.category, p.unit_price, p.stock, p.min_stock
               ORDER BY total_revenue DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      report: {
        period: {
          start: start_date || 'Início',
          end: end_date || 'Hoje'
        },
        products: result.rows,
        summary: {
          total_products: result.rowCount,
          low_stock: result.rows.filter(p => p.stock_status === 'BAIXO').length,
          warning_stock: result.rows.filter(p => p.stock_status === 'ALERTA').length,
          total_inventory_value: result.rows.reduce((sum, p) => sum + (p.unit_price * p.stock), 0)
        }
      }
    });
    
  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório de produtos.'
    });
  }
});

// Relatório de clientes
app.get('/api/reports/clients', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date,
      end_date,
      category
    } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.category,
        c.total_spent,
        c.last_purchase,
        COUNT(s.id) as total_purchases,
        COALESCE(SUM(s.final_amount), 0) as period_spent,
        CASE 
          WHEN c.last_purchase >= CURRENT_DATE - INTERVAL '30 days' THEN 'ATIVO'
          WHEN c.last_purchase >= CURRENT_DATE - INTERVAL '90 days' THEN 'INATIVO_RECENTE'
          ELSE 'INATIVO'
        END as status
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date && end_date) {
      query += ` AND s.sale_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(start_date, end_date);
      paramCount += 2;
    }
    
    if (category) {
      query += ` AND c.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` GROUP BY c.id, c.name, c.email, c.phone, c.category, c.total_spent, c.last_purchase
               ORDER BY period_spent DESC NULLS LAST`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      report: {
        period: {
          start: start_date || 'Início',
          end: end_date || 'Hoje'
        },
        clients: result.rows,
        summary: {
          total_clients: result.rowCount,
          active_clients: result.rows.filter(c => c.status === 'ATIVO').length,
          vip_clients: result.rows.filter(c => c.category === 'VIP').length,
          corporate_clients: result.rows.filter(c => c.category === 'corporate').length,
          total_revenue: result.rows.reduce((sum, c) => sum + (c.period_spent || 0), 0)
        }
      }
    });
    
  } catch (error) {
    console.error('Clients report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório de clientes.'
    });
  }
});

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

function calculateGrowth(today, yesterday) {
  if (yesterday === 0) {
    return today > 0 ? 100 : 0;
  }
  return ((today - yesterday) / yesterday * 100).toFixed(1);
}

// ==============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ==============================================
async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');
    
    // Criar tabelas (igual ao seu código)
    await pool.query(`
      -- Usuários
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Clientes
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(50),
        province VARCHAR(50),
        category VARCHAR(50) DEFAULT 'normal',
        total_spent DECIMAL(12, 2) DEFAULT 0,
        last_purchase DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Produtos
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        unit_price DECIMAL(12, 2) NOT NULL,
        cost_price DECIMAL(12, 2),
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 10,
        supplier VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Vendas
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        total_amount DECIMAL(12, 2) NOT NULL,
        discount DECIMAL(12, 2) DEFAULT 0,
        tax DECIMAL(12, 2) DEFAULT 0,
        final_amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        status VARCHAR(20) DEFAULT 'completed',
        notes TEXT,
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Itens da venda
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Criar índices para performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
      CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    `);
    
    // Criar admin padrão se não existir
    const adminExists = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@bizzflow.com'"
    );
    
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (name, email, password, role) 
         VALUES ('Administrador', 'admin@bizzflow.com', $1, 'admin')`,
        [hashedPassword]
      );
      console.log('👤 Usuário admin criado: admin@bizzflow.com / admin123');
    }
    
    // Inserir dados de exemplo se não existirem
    const clientsExist = await pool.query('SELECT COUNT(*) FROM clients');
    if (parseInt(clientsExist.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO clients (name, email, phone, category) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'VIP'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'normal'),
        ('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'corporate'),
        ('Carlos Mendes', 'carlos@email.com', '+258844567890', 'normal'),
        ('Ana Pereira', 'ana@email.com', '+258845678901', 'VIP')
      `);
      console.log('👥 5 clientes de exemplo criados');
    }
    
    const productsExist = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(productsExist.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO products (code, name, category, unit_price, stock, min_stock) VALUES
        ('PROD001', 'Arroz 5kg', 'Alimentos', 350.00, 100, 20),
        ('PROD002', 'Azeite 1L', 'Alimentos', 850.00, 50, 10),
        ('PROD003', 'Detergente', 'Limpeza', 45.00, 200, 50),
        ('PROD004', 'Sabonete', 'Higiene', 25.00, 150, 30),
        ('PROD005', 'Leite 1L', 'Laticínios', 60.00, 80, 20),
        ('PROD006', 'Café 250g', 'Alimentos', 250.00, 120, 30),
        ('PROD007', 'Açúcar 1kg', 'Alimentos', 80.00, 200, 50),
        ('PROD008', 'Óleo 1L', 'Alimentos', 120.00, 100, 25)
      `);
      console.log('📦 8 produtos de exemplo criados');
    }
    
    const salesExist = await pool.query('SELECT COUNT(*) FROM sales');
    if (parseInt(salesExist.rows[0].count) === 0) {
      // Criar algumas vendas de exemplo
      const date = new Date();
      const saleNumber1 = `V${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}001`;
      const saleNumber2 = `V${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${(date.getDate() - 1).toString().padStart(2, '0')}002`;
      
      // Venda 1
      const sale1 = await pool.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [saleNumber1, 1, 1200, 50, 0, 1150, 'cash']
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale1.rows[0].id, 1, 2, 350, 700]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale1.rows[0].id, 2, 1, 850, 850]
      );
      
      // Venda 2
      const sale2 = await pool.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [saleNumber2, 2, 325, 0, 0, 325, 'card']
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale2.rows[0].id, 3, 5, 45, 225]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale2.rows[0].id, 4, 4, 25, 100]
      );
      
      console.log('💰 2 vendas de exemplo criadas');
    }
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
  }
}

// ==============================================
// SERVE FRONTEND ESTÁTICO
// ==============================================
app.use(express.static('.'));

// Rota catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
async function startServer() {
  try {
    // Inicializar banco
    await initializeDatabase();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   BIZZ FLOW CRM v3.0                          ║
╠════════════════════════════════════════════════════════════════╣
║ Status:        ✅ ONLINE                                      ║
║ Ambiente:      ${process.env.NODE_ENV || 'development'.padEnd(40)} ║
║ Porta:         ${PORT.toString().padEnd(43)} ║
║ URL:           http://localhost:${PORT.toString().padEnd(39)} ║
║ Banco:         PostgreSQL (Render)                            ║
║                                                               ║
║ 🔧 ENDPOINTS DISPONÍVEIS:                                    ║
║   • /health             → Health check                       ║
║   • /api/auth/login     → Login (admin/admin123)            ║
║   • /api/auth/profile   → Perfil do usuário                 ║
║   • /api/clients/*      → CRUD completo de clientes         ║
║   • /api/products/*     → CRUD completo de produtos         ║
║   • /api/sales/*        → CRUD completo de vendas           ║
║   • /api/dashboard/*    → Dashboard e gráficos              ║
║   • /api/reports/*      → Relatórios detalhados             ║
║                                                               ║
║ 📊 DADOS DE EXEMPLO:                                         ║
║   • 5 clientes          • 8 produtos                        ║
║   • 2 vendas            • Usuário admin criado              ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar
startServer();
