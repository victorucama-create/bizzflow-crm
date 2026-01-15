// ==============================================
// BIZZFLOW CRM v4.0 - SERVER COMPLETO FUNCIONAL
// ==============================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ==============================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ==============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false
}));

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'x-access-token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==============================================
const authenticateToken = async (req, res, next) => {
  try {
    let token = req.headers['authorization']?.split(' ')[1] || 
                req.query.token || 
                req.headers['x-access-token'];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token não fornecido.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024');
    
    const userResult = await pool.query(
      'SELECT id, email, role, name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
    }
    
    if (!userResult.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Usuário inativo.' });
    }
    
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    req.userName = decoded.name;
    
    next();
  } catch (error) {
    console.error('Erro na verificação do token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expirado. Faça login novamente.' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token inválido.' });
    }
    
    return res.status(401).json({ success: false, message: 'Falha na autenticação.' });
  }
};

// ==============================================
// ROTAS PÚBLICAS
// ==============================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      service: 'BizzFlow CRM API v4.0',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ success: false, status: 'unhealthy', error: error.message });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API BizzFlow CRM v4.0 está funcionando! 🚀',
    endpoints: {
      auth: 'POST /api/auth/login',
      clients: 'GET /api/clients',
      products: 'GET /api/products',
      sales: 'GET /api/sales',
      reports: 'GET /api/reports/sales'
    }
  });
});

// ==============================================
// AUTENTICAÇÃO
// ==============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
    }
    
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email ou senha incorretos.' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Conta desativada.' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Email ou senha incorretos.' });
    }
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'user',
      name: user.name || 'Usuário'
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024',
      { expiresIn: '7d' }
    );
    
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    const { password: _, ...userResponse } = user;
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso!',
      token: token,
      user: userResponse
    });
    
  } catch (error) {
    console.error('ERRO NO LOGIN:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: {
      id: req.userId,
      email: req.userEmail,
      role: req.userRole,
      name: req.userName
    }
  });
});

// ==============================================
// API - CLIENTES
// ==============================================
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM clients';
    let params = [];
    let count = 1;
    
    if (search) {
      query += ` WHERE name ILIKE $${count} OR email ILIKE $${count} OR phone ILIKE $${count}`;
      params.push(`%${search}%`);
      count++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${count} OFFSET $${count + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM clients');
    
    res.json({
      success: true,
      clients: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar clientes.' });
  }
});

app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, 
       (SELECT COUNT(*) FROM sales WHERE client_id = c.id) as total_sales,
       (SELECT SUM(final_amount) FROM sales WHERE client_id = c.id) as total_spent
       FROM clients c WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    res.json({ success: true, client: result.rows[0] });
    
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar cliente.' });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, city, province, category, nif, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
    }
    
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, province, category, nif, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, email || null, phone || null, address || null, city || null, province || null, 
       category || 'normal', nif || null, notes || null]
    );
    
    res.status(201).json({
      success: true,
      client: result.rows[0],
      message: 'Cliente criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar cliente.' });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, province, category, nif, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, email = $2, phone = $3, address = $4, city = $5, 
           province = $6, category = $7, nif = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, email, phone, address, city, province, category, nif, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    res.json({
      success: true,
      client: result.rows[0],
      message: 'Cliente atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar cliente.' });
  }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    res.json({ success: true, message: 'Cliente excluído com sucesso!' });
    
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao excluir cliente.' });
  }
});

// ==============================================
// API - PRODUTOS
// ==============================================
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', low_stock = false } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    let params = [];
    let count = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${count} OR code ILIKE $${count} OR description ILIKE $${count})`;
      params.push(`%${search}%`);
      count++;
    }
    
    if (low_stock === 'true') {
      query += ` AND stock <= min_stock`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${count} OFFSET $${count + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = true');
    
    res.json({
      success: true,
      products: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produtos.' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    res.json({ success: true, product: result.rows[0] });
    
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { code, name, description, category, unit_price, cost_price, stock, min_stock, supplier, barcode } = req.body;
    
    if (!code || !name || !unit_price) {
      return res.status(400).json({ success: false, message: 'Código, nome e preço são obrigatórios.' });
    }
    
    const result = await pool.query(
      `INSERT INTO products (code, name, description, category, unit_price, cost_price, stock, min_stock, supplier, barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [code, name, description || null, category || null, unit_price, cost_price || null, 
       stock || 0, min_stock || 10, supplier || null, barcode || null]
    );
    
    res.status(201).json({
      success: true,
      product: result.rows[0],
      message: 'Produto criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar produto.' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, category, unit_price, cost_price, stock, min_stock, supplier, barcode, is_active } = req.body;
    
    const result = await pool.query(
      `UPDATE products 
       SET code = $1, name = $2, description = $3, category = $4, unit_price = $5,
           cost_price = $6, stock = $7, min_stock = $8, supplier = $9, barcode = $10,
           is_active = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [code, name, description, category, unit_price, cost_price, stock, min_stock, 
       supplier, barcode, is_active !== false, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    res.json({
      success: true,
      product: result.rows[0],
      message: 'Produto atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar produto.' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    res.json({ success: true, message: 'Produto desativado com sucesso!' });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar produto.' });
  }
});

// ==============================================
// API - VENDAS
// ==============================================
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND DATE(s.sale_date) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(s.sale_date) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Buscar itens das vendas
    for (let sale of result.rows) {
      const itemsResult = await pool.query(
        `SELECT si.*, p.name as product_name, p.code as product_code
         FROM sale_items si
         JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      sale.items = itemsResult.rows;
    }
    
    const countQuery = start_date || end_date ? 
      'SELECT COUNT(*) FROM sales WHERE 1=1' + (start_date ? ' AND DATE(sale_date) >= $1' : '') + (end_date ? ' AND DATE(sale_date) <= $2' : '') :
      'SELECT COUNT(*) FROM sales';
    
    const countResult = await pool.query(countQuery, start_date || end_date ? [start_date, end_date].filter(Boolean) : []);
    
    res.json({
      success: true,
      sales: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar vendas.' });
  }
});

app.get('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const saleResult = await pool.query(
      `SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venda não encontrada.' });
    }
    
    const sale = saleResult.rows[0];
    
    const itemsResult = await pool.query(
      `SELECT si.*, p.name as product_name, p.code as product_code, p.unit_price
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [id]
    );
    
    sale.items = itemsResult.rows;
    
    res.json({ success: true, sale: sale });
    
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar venda.' });
  }
});

app.post('/api/sales', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      client_id, 
      items, 
      discount = 0, 
      tax = 0, 
      payment_method = 'cash', 
      notes,
      amount_received
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'É necessário pelo menos um item.' });
    }
    
    // Calcular totais
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.unit_price * item.quantity;
    }
    
    const final_amount = subtotal - discount + tax;
    
    if (amount_received && amount_received < final_amount) {
      return res.status(400).json({ success: false, message: 'Valor recebido é menor que o total.' });
    }
    
    // Gerar número da venda
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const countResult = await client.query(
      'SELECT COUNT(*) FROM sales WHERE DATE(created_at) = CURRENT_DATE'
    );
    const dailyCount = parseInt(countResult.rows[0].count) + 1;
    
    const sale_number = `V${year}${month}${day}${String(dailyCount).padStart(4, '0')}`;
    
    // Criar venda
    const saleResult = await client.query(
      `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method, notes, amount_received)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [sale_number, client_id || null, subtotal, discount, tax, final_amount, payment_method, notes || null, amount_received || final_amount]
    );
    
    const sale = saleResult.rows[0];
    
    // Adicionar itens e atualizar stock
    for (const item of items) {
      // Inserir item da venda
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale.id, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );
      
      // Atualizar stock do produto
      await client.query(
        'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
    // Atualizar cliente se houver
    if (client_id) {
      await client.query(
        `UPDATE clients 
         SET total_spent = COALESCE(total_spent, 0) + $1, 
             last_purchase = CURRENT_DATE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [final_amount, client_id]
      );
    }
    
    await client.query('COMMIT');
    
    // Buscar venda completa para retornar
    const completeSale = await getCompleteSale(sale.id);
    
    res.status(201).json({
      success: true,
      sale: completeSale,
      message: 'Venda registrada com sucesso!',
      receipt: {
        number: sale_number,
        total: final_amount,
        change: amount_received ? amount_received - final_amount : 0
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create sale error:', error);
    res.status(500).json({ success: false, message: 'Erro ao registrar venda.' });
  } finally {
    client.release();
  }
});

async function getCompleteSale(saleId) {
  const saleResult = await pool.query(
    `SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone
     FROM sales s
     LEFT JOIN clients c ON s.client_id = c.id
     WHERE s.id = $1`,
    [saleId]
  );
  
  const sale = saleResult.rows[0];
  
  const itemsResult = await pool.query(
    `SELECT si.*, p.name as product_name, p.code as product_code
     FROM sale_items si
     JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = $1`,
    [saleId]
  );
  
  sale.items = itemsResult.rows;
  return sale;
}

// ==============================================
// API - FORNECEDORES
// ==============================================
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM suppliers WHERE is_active = true';
    let params = [];
    let count = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${count} OR contact ILIKE $${count} OR email ILIKE $${count})`;
      params.push(`%${search}%`);
      count++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${count} OFFSET $${count + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      suppliers: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar fornecedores.' });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { name, contact, email, address, products, rating } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
    }
    
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact, email, address, products, rating)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, contact || null, email || null, address || null, 
       Array.isArray(products) ? products : [products || ''], rating || 0]
    );
    
    res.status(201).json({
      success: true,
      supplier: result.rows[0],
      message: 'Fornecedor criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar fornecedor.' });
  }
});

// ==============================================
// API - EQUIPA
// ==============================================
app.get('/api/team', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM team WHERE is_active = true';
    let params = [];
    let count = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${count} OR role ILIKE $${count} OR contact ILIKE $${count})`;
      params.push(`%${search}%`);
      count++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${count} OFFSET $${count + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Calcular vendas de cada membro
    for (let member of result.rows) {
      const salesResult = await pool.query(
        'SELECT COUNT(*) as total_sales, SUM(final_amount) as total_amount FROM sales WHERE seller_id = $1',
        [member.id]
      );
      member.total_sales = parseInt(salesResult.rows[0].total_sales) || 0;
      member.total_amount = parseFloat(salesResult.rows[0].total_amount) || 0;
    }
    
    res.json({
      success: true,
      team: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar equipa.' });
  }
});

app.post('/api/team', authenticateToken, async (req, res) => {
  try {
    const { name, role, contact, email, join_date } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Nome e cargo são obrigatórios.' });
    }
    
    const result = await pool.query(
      `INSERT INTO team (name, role, contact, email, join_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, role, contact || null, email || null, join_date || new Date().toISOString().split('T')[0]]
    );
    
    res.status(201).json({
      success: true,
      member: result.rows[0],
      message: 'Membro da equipa criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create team member error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar membro da equipa.' });
  }
});

// ==============================================
// API - RELATÓRIOS
// ==============================================
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    
    let query = `
      SELECT 
        DATE(sale_date) as date,
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_value,
        MIN(final_amount) as min_sale_value,
        MAX(final_amount) as max_sale_value
      FROM sales
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND DATE(sale_date) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(sale_date) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (group_by === 'day') {
      query += ` GROUP BY DATE(sale_date) ORDER BY DATE(sale_date) DESC`;
    } else if (group_by === 'week') {
      query = `
        SELECT 
          DATE_TRUNC('week', sale_date) as week,
          COUNT(*) as total_sales,
          SUM(final_amount) as total_revenue,
          AVG(final_amount) as avg_sale_value
        FROM sales
        WHERE 1=1
      ` + (start_date ? ` AND DATE(sale_date) >= $${paramCount}` : '') + 
        (end_date ? ` AND DATE(sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : '') +
        ` GROUP BY DATE_TRUNC('week', sale_date) ORDER BY DATE_TRUNC('week', sale_date) DESC`;
    } else if (group_by === 'month') {
      query = `
        SELECT 
          DATE_TRUNC('month', sale_date) as month,
          COUNT(*) as total_sales,
          SUM(final_amount) as total_revenue,
          AVG(final_amount) as avg_sale_value
        FROM sales
        WHERE 1=1
      ` + (start_date ? ` AND DATE(sale_date) >= $${paramCount}` : '') + 
        (end_date ? ` AND DATE(sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : '') +
        ` GROUP BY DATE_TRUNC('month', sale_date) ORDER BY DATE_TRUNC('month', sale_date) DESC`;
    }
    
    const result = await pool.query(query, params);
    
    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_value,
        MIN(final_amount) as min_sale_value,
        MAX(final_amount) as max_sale_value,
        COUNT(DISTINCT client_id) as unique_clients
      FROM sales
      WHERE 1=1
      ${start_date ? ` AND DATE(sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
    `;
    
    const statsResult = await pool.query(statsQuery, params);
    
    // Produtos mais vendidos
    const topProductsQuery = `
      SELECT 
        p.name as product_name,
        p.code as product_code,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY p.id, p.name, p.code
      ORDER BY total_quantity DESC
      LIMIT 10
    `;
    
    const topProductsResult = await pool.query(topProductsQuery, params);
    
    res.json({
      success: true,
      report: {
        summary: result.rows,
        statistics: statsResult.rows[0],
        top_products: topProductsResult.rows
      }
    });
    
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendas.' });
  }
});

app.get('/api/reports/products', authenticateToken, async (req, res) => {
  try {
    const { low_stock = false, category } = req.query;
    
    let query = `
      SELECT 
        p.*,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE p.is_active = true
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (low_stock === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` GROUP BY p.id ORDER BY total_sold DESC`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas por categoria
    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as total_products,
        SUM(stock) as total_stock,
        AVG(unit_price) as avg_price
      FROM products
      WHERE is_active = true
      GROUP BY category
      ORDER BY total_products DESC
    `;
    
    const categoryStatsResult = await pool.query(categoryStatsQuery);
    
    res.json({
      success: true,
      report: {
        products: result.rows,
        category_stats: categoryStatsResult.rows,
        total_products: result.rows.length,
        low_stock_count: result.rows.filter(p => p.stock <= p.min_stock).length
      }
    });
    
  } catch (error) {
    console.error('Get products report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório de produtos.' });
  }
});

app.get('/api/reports/clients', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `
      SELECT 
        c.*,
        COUNT(s.id) as total_purchases,
        COALESCE(SUM(s.final_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (category) {
      query += ` AND c.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` GROUP BY c.id ORDER BY total_spent DESC`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas por categoria
    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as total_clients,
        COUNT(CASE WHEN last_purchase >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_clients,
        AVG(total_spent) as avg_spent
      FROM clients
      GROUP BY category
    `;
    
    const categoryStatsResult = await pool.query(categoryStatsQuery);
    
    res.json({
      success: true,
      report: {
        clients: result.rows,
        category_stats: categoryStatsResult.rows,
        total_clients: result.rows.length,
        active_clients: result.rows.filter(c => c.last_purchase_date && 
          new Date(c.last_purchase_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
      }
    });
    
  } catch (error) {
    console.error('Get clients report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório de clientes.' });
  }
});

app.get('/api/reports/financial', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Receitas de vendas
    let salesQuery = `
      SELECT 
        DATE_TRUNC('month', sale_date) as month,
        SUM(final_amount) as revenue
      FROM sales
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (start_date) {
      salesQuery += ` AND DATE(sale_date) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      salesQuery += ` AND DATE(sale_date) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    salesQuery += ` GROUP BY DATE_TRUNC('month', sale_date) ORDER BY DATE_TRUNC('month', sale_date) DESC`;
    
    const salesResult = await pool.query(salesQuery, params);
    
    // Custo dos produtos vendidos
    const cogsQuery = `
      SELECT 
        DATE_TRUNC('month', s.sale_date) as month,
        SUM(si.quantity * p.cost_price) as cost_of_goods_sold
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE 1=1
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY DATE_TRUNC('month', s.sale_date)
      ORDER BY DATE_TRUNC('month', s.sale_date) DESC
    `;
    
    const cogsResult = await pool.query(cogsQuery, start_date || end_date ? params : []);
    
    // Resumo financeiro
    const summaryQuery = `
      SELECT 
        SUM(s.final_amount) as total_revenue,
        SUM(si.quantity * p.cost_price) as total_cogs,
        COUNT(DISTINCT s.client_id) as total_clients,
        COUNT(DISTINCT s.id) as total_sales,
        AVG(s.final_amount) as avg_sale_value
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE 1=1
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
    `;
    
    const summaryResult = await pool.query(summaryQuery, start_date || end_date ? params : []);
    
    res.json({
      success: true,
      report: {
        monthly_revenue: salesResult.rows,
        monthly_cogs: cogsResult.rows,
        summary: summaryResult.rows[0],
        gross_profit: summaryResult.rows[0] ? 
          summaryResult.rows[0].total_revenue - summaryResult.rows[0].total_cogs : 0
      }
    });
    
  } catch (error) {
    console.error('Get financial report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório financeiro.' });
  }
});

// ==============================================
// API - INVENTÁRIO
// ==============================================
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { low_stock = false, category } = req.query;
    
    let query = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM sale_items WHERE product_id = p.id) as times_sold,
        (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id) as total_sold
      FROM products p
      WHERE p.is_active = true
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (low_stock === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` ORDER BY p.stock ASC`;
    
    const result = await pool.query(query, params);
    
    // Valor total em stock
    const totalValueQuery = `
      SELECT SUM(stock * unit_price) as total_value FROM products WHERE is_active = true
    `;
    const totalValueResult = await pool.query(totalValueQuery);
    
    // Produtos que precisam de reposição
    const reorderQuery = `
      SELECT COUNT(*) as need_reorder 
      FROM products 
      WHERE is_active = true AND stock <= min_stock
    `;
    const reorderResult = await pool.query(reorderQuery);
    
    res.json({
      success: true,
      inventory: result.rows,
      summary: {
        total_products: result.rows.length,
        total_value: totalValueResult.rows[0].total_value || 0,
        need_reorder: reorderResult.rows[0].need_reorder || 0,
        low_stock_count: result.rows.filter(p => p.stock <= p.min_stock).length
      }
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar inventário.' });
  }
});

app.get('/api/inventory/movements', authenticateToken, async (req, res) => {
  try {
    const { product_id, type, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        im.*,
        p.name as product_name,
        p.code as product_code,
        u.name as user_name
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (product_id) {
      query += ` AND im.product_id = $${paramCount}`;
      params.push(product_id);
      paramCount++;
    }
    
    if (type) {
      query += ` AND im.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND DATE(im.created_at) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(im.created_at) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    query += ` ORDER BY im.created_at DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      movements: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Get inventory movements error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar movimentações de inventário.' });
  }
});

app.post('/api/inventory/movements', authenticateToken, async (req, res) => {
  try {
    const { product_id, type, quantity, reason, notes } = req.body;
    
    if (!product_id || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'Produto, tipo e quantidade são obrigatórios.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Criar movimentação
      const movementResult = await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [product_id, type, quantity, reason || null, notes || null, req.userId]
      );
      
      // Atualizar stock do produto
      if (type === 'entrada') {
        await client.query(
          'UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantity, product_id]
        );
      } else if (type === 'saida') {
        await client.query(
          'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantity, product_id]
        );
      } else if (type === 'ajuste') {
        await client.query(
          'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quantity, product_id]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        movement: movementResult.rows[0],
        message: 'Movimentação de inventário registrada com sucesso!'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Create inventory movement error:', error);
    res.status(500).json({ success: false, message: 'Erro ao registrar movimentação de inventário.' });
  }
});

// ==============================================
// API - CONFIGURAÇÕES
// ==============================================
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings');
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({ success: true, settings: settings });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar configurações.' });
  }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = req.body;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO system_settings (key, value) 
           VALUES ($1, $2)
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
          [key, value]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ success: true, message: 'Configurações atualizadas com sucesso!' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar configurações.' });
  }
});

// ==============================================
// API - ENCOMENDAS
// ==============================================
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*, c.name as client_name, c.phone as client_phone
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Buscar itens das encomendas
    for (let order of result.rows) {
      const itemsResult = await pool.query(
        `SELECT oi.*, p.name as product_name, p.code as product_code
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;
    }
    
    res.json({
      success: true,
      orders: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar encomendas.' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { client_id, items, delivery_date, notes } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'É necessário pelo menos um item.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Calcular total
      let total = 0;
      for (const item of items) {
        const productResult = await client.query(
          'SELECT unit_price FROM products WHERE id = $1',
          [item.product_id]
        );
        
        if (productResult.rows.length === 0) {
          throw new Error(`Produto ${item.product_id} não encontrado`);
        }
        
        const unitPrice = productResult.rows[0].unit_price;
        total += unitPrice * item.quantity;
      }
      
      // Criar encomenda
      const orderResult = await client.query(
        `INSERT INTO orders (order_number, client_id, total_amount, delivery_date, notes, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [`ORD${Date.now()}`, client_id || null, total, delivery_date || null, notes || null]
      );
      
      const order = orderResult.rows[0];
      
      // Adicionar itens
      for (const item of items) {
        const productResult = await client.query(
          'SELECT unit_price FROM products WHERE id = $1',
          [item.product_id]
        );
        
        const unitPrice = productResult.rows[0].unit_price;
        
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.product_id, item.quantity, unitPrice, unitPrice * item.quantity]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        order: order,
        message: 'Encomenda criada com sucesso!'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar encomenda.' });
  }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inválido.' });
    }
    
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Encomenda não encontrada.' });
    }
    
    // Se a encomenda foi completada, atualizar stock
    if (status === 'completed') {
      const itemsResult = await pool.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
        [id]
      );
      
      for (const item of itemsResult.rows) {
        await pool.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }
    
    res.json({
      success: true,
      order: result.rows[0],
      message: `Encomenda ${status === 'completed' ? 'completada' : 'atualizada'} com sucesso!`
    });
    
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar encomenda.' });
  }
});

// ==============================================
// API - ASSINATURAS (PLANOS)
// ==============================================
app.get('/api/subscriptions/plans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price');
    
    res.json({ success: true, plans: result.rows });
    
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar planos.' });
  }
});

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT s.*, p.name as plan_name, p.price as plan_price, c.name as client_name
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.id
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (status) {
      query += ` AND s.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY s.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, subscriptions: result.rows });
    
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar assinaturas.' });
  }
});

// ==============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ==============================================
async function initializeDatabase() {
  console.log('🔄 Inicializando banco de dados...');
  
  try {
    // Criar tabelas se não existirem
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
        nif VARCHAR(20),
        notes TEXT,
        total_spent DECIMAL(12, 2) DEFAULT 0,
        last_purchase DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
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
        barcode VARCHAR(50),
        supplier VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Fornecedores
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        contact VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        products TEXT[] DEFAULT '{}',
        rating DECIMAL(3, 1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Vendas
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        seller_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(12, 2) NOT NULL,
        discount DECIMAL(12, 2) DEFAULT 0,
        tax DECIMAL(12, 2) DEFAULT 0,
        final_amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        amount_received DECIMAL(12, 2),
        status VARCHAR(20) DEFAULT 'completed',
        notes TEXT,
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      
      -- Equipa
      CREATE TABLE IF NOT EXISTS team (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        contact VARCHAR(20),
        email VARCHAR(100),
        join_date DATE DEFAULT CURRENT_DATE,
        salary DECIMAL(12, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Movimentações de Inventário
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        type VARCHAR(20) NOT NULL, -- entrada, saida, ajuste
        quantity INTEGER NOT NULL,
        reason VARCHAR(100),
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Encomendas
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        total_amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        delivery_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Itens da encomenda
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Planos de Assinatura
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(12, 2) NOT NULL,
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        features TEXT[] DEFAULT '{}',
        max_clients INTEGER,
        max_products INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Assinaturas
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id),
        plan_id INTEGER REFERENCES subscription_plans(id),
        start_date DATE NOT NULL,
        end_date DATE,
        next_payment_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        payment_method VARCHAR(50),
        auto_renew BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Configurações do Sistema
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Tabelas criadas/verificadas');
    
    // Verificar se usuário admin existe
    const adminExists = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@bizzflow.com'"
    );
    
    if (adminExists.rows.length === 0) {
      console.log('👤 Criando usuário admin padrão...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(
        `INSERT INTO users (name, email, password, role) 
         VALUES ($1, $2, $3, $4)`,
        ['Administrador', 'admin@bizzflow.com', hashedPassword, 'admin']
      );
      
      console.log('✅ Usuário admin criado: admin@bizzflow.com / admin123');
    }
    
    // Inserir configurações padrão
    const defaultSettings = {
      'company_name': 'Bizz Flow Lda',
      'company_nif': '123456789',
      'company_address': 'Av. 25 de Setembro, Maputo',
      'company_phone': '+258 84 123 4567',
      'company_email': 'info@bizzflow.co.mz',
      'currency': 'MZN',
      'tax_rate': '17',
      'low_stock_threshold': '10',
      'invoice_prefix': 'FAT',
      'invoice_start_number': '1001',
      'timezone': 'Africa/Maputo',
      'enable_stock_alerts': 'true',
      'enable_sales_reports': 'true',
      'auto_print_invoice': 'true'
    };
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      await pool.query(
        `INSERT INTO system_settings (key, value) 
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    
    console.log('✅ Configurações padrão inseridas');
    
    // Criar dados de exemplo se não existirem
    await createSampleData();
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function createSampleData() {
  try {
    // Verificar se já existem dados
    const clientsCount = await pool.query('SELECT COUNT(*) as count FROM clients');
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM products');
    
    if (parseInt(clientsCount.rows[0].count) === 0) {
      console.log('👥 Criando clientes de exemplo...');
      await pool.query(`
        INSERT INTO clients (name, email, phone, address, category, nif) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'Maputo', 'VIP', '100000001'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'Matola', 'normal', '100000002'),
        ('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'Beira', 'corporate', '100000003'),
        ('Carlos Mendes', 'carlos@email.com', '+258844567890', 'Nampula', 'wholesale', '100000004'),
        ('Ana Pereira', 'ana@email.com', '+258845678901', 'Quelimane', 'normal', '100000005')
      `);
    }
    
    if (parseInt(productsCount.rows[0].count) === 0) {
      console.log('📦 Criando produtos de exemplo...');
      await pool.query(`
        INSERT INTO products (code, name, category, unit_price, cost_price, stock, min_stock) VALUES
        ('PROD001', 'Arroz 5kg', 'Alimentos', 350.00, 280.00, 100, 20),
        ('PROD002', 'Feijão 1kg', 'Alimentos', 120.00, 90.00, 50, 15),
        ('PROD003', 'Óleo 1L', 'Alimentos', 150.00, 110.00, 75, 10),
        ('PROD004', 'Açúcar 1kg', 'Alimentos', 80.00, 60.00, 120, 30),
        ('PROD005', 'Sabão em Pó', 'Limpeza', 85.00, 60.00, 45, 10),
        ('PROD006', 'Detergente 500ml', 'Limpeza', 65.00, 45.00, 80, 20),
        ('PROD007', 'Água 1.5L', 'Bebidas', 25.00, 15.00, 200, 50),
        ('PROD008', 'Refrigerante 2L', 'Bebidas', 95.00, 70.00, 60, 15),
        ('PROD009', 'Cerveja 330ml', 'Bebidas', 45.00, 30.00, 150, 30),
        ('PROD010', 'Leite 1L', 'Laticínios', 55.00, 40.00, 90, 20)
      `);
    }
    
    // Verificar fornecedores
    const suppliersCount = await pool.query('SELECT COUNT(*) as count FROM suppliers');
    if (parseInt(suppliersCount.rows[0].count) === 0) {
      console.log('🚚 Criando fornecedores de exemplo...');
      await pool.query(`
        INSERT INTO suppliers (name, contact, email, address, products, rating) VALUES
        ('Fornecedor A', '+258841111111', 'fornecedorA@email.com', 'Maputo', '{"Arroz", "Feijão", "Açúcar"}', 4.5),
        ('Fornecedor B', '+258842222222', 'fornecedorB@email.com', 'Matola', '{"Óleo", "Margarina"}', 4.2),
        ('Fornecedor C', '+258843333333', 'fornecedorC@email.com', 'Beira', '{"Sabão", "Detergente"}', 4.0),
        ('Fornecedor D', '+258844444444', 'fornecedorD@email.com', 'Nampula', '{"Bebidas", "Água"}', 4.7),
        ('Fornecedor E', '+258845555555', 'fornecedorE@email.com', 'Quelimane', '{"Leite", "Queijo"}', 4.3)
      `);
    }
    
    // Verificar equipa
    const teamCount = await pool.query('SELECT COUNT(*) as count FROM team');
    if (parseInt(teamCount.rows[0].count) === 0) {
      console.log('👥 Criando equipa de exemplo...');
      await pool.query(`
        INSERT INTO team (name, role, contact, email, join_date) VALUES
        ('Carlos Vendedor', 'Vendedor', '+258846666666', 'carlos@bizzflow.co.mz', '2024-01-10'),
        ('Ana Gestora', 'Gestora', '+258847777777', 'ana@bizzflow.co.mz', '2024-01-15'),
        ('Pedro Estoquista', 'Estoquista', '+258848888888', 'pedro@bizzflow.co.mz', '2024-01-20'),
        ('Sofia Atendente', 'Atendente', '+258849999999', 'sofia@bizzflow.co.mz', '2024-01-25')
      `);
    }
    
    console.log('✅ Dados de exemplo criados');
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de exemplo:', error.message);
  }
}

// ==============================================
// CONFIGURAÇÃO DO FRONTEND
// ==============================================
app.use(express.static('.', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') || path.endsWith('.jpg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Rotas do frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/clients', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/products', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/sales', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/reports', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/inventory', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Rota catch-all para SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Endpoint não encontrado.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
async function startServer() {
  try {
    console.log('='.repeat(60));
    console.log('🚀 INICIANDO BIZZFLOW CRM v4.0');
    console.log('='.repeat(60));
    
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM v4.0 - ONLINE                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║ ✅ STATUS:         SERVIDOR ATIVO                                       ║
║ 📍 PORTA:          ${PORT.toString().padEnd(45)} ║
║ 🌍 AMBIENTE:       ${(process.env.NODE_ENV || 'development').padEnd(44)} ║
║ 🔗 URL LOCAL:      http://localhost:${PORT.toString().padEnd(40)} ║
║ 👤 LOGIN:          admin@bizzflow.com / admin123                       ║
║                                                                          ║
║ 📡 ENDPOINTS DISPONÍVEIS:                                              ║
║   • POST   /api/auth/login                                              ║
║   • GET    /api/clients                                                 ║
║   • POST   /api/clients                                                 ║
║   • GET    /api/products                                                ║
║   • POST   /api/products                                                ║
║   • GET    /api/sales                                                   ║
║   • POST   /api/sales                                                   ║
║   • GET    /api/reports/sales                                           ║
║   • GET    /api/reports/products                                        ║
║   • GET    /api/reports/clients                                         ║
║   • GET    /api/reports/financial                                       ║
║   • GET    /api/inventory                                               ║
║   • GET    /api/suppliers                                               ║
║   • POST   /api/suppliers                                               ║
║   • GET    /api/team                                                    ║
║   • POST   /api/team                                                    ║
║   • GET    /api/orders                                                  ║
║   • POST   /api/orders                                                  ║
║   • GET    /api/settings                                                ║
║   • POST   /api/settings                                                ║
╚══════════════════════════════════════════════════════════════════════════╝
      `);
      console.log(`🕐 Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
    });
    
  } catch (error) {
    console.error('❌ FALHA CATASTRÓFICA AO INICIAR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

startServer();
