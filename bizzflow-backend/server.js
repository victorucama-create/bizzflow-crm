// ==============================================
// BIZZFLOW CRM v5.0 - SERVER COMPLETO FUNCIONAL
// Versão unificada com todas as funcionalidades
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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ==============================================
// CONFIGURAÇÃO MULTER PARA UPLOADS
// ==============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
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
  origin: ['http://localhost:3000', 'http://localhost:10000', 'https://bizzflow-crm.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'x-access-token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Criar pasta uploads se não existir
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Middleware para logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} ${req.ip}`);
  next();
});

// Middleware para servir arquivos estáticos
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

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

// Middleware para admin
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso restrito a administradores.' });
  }
  next();
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
      service: 'BizzFlow CRM API v5.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '5.0.0'
    });
  } catch (error) {
    res.status(500).json({ success: false, status: 'unhealthy', error: error.message });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API BizzFlow CRM v5.0 está funcionando! 🚀',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: 'POST /api/auth/login',
      clients: 'GET /api/clients',
      products: 'GET /api/products',
      sales: 'GET /api/sales',
      reports: 'GET /api/reports/sales',
      inventory: 'GET /api/inventory',
      dashboard: 'GET /api/dashboard/stats'
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
      user: userResponse,
      permissions: getUserPermissions(user.role)
    });
    
  } catch (error) {
    console.error('ERRO NO LOGIN:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios.' });
    }
    
    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email já está em uso.' });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role) 
       VALUES ($1, $2, $3, 'user') 
       RETURNING id, name, email, role, created_at, is_active`,
      [name, email.toLowerCase().trim(), hashedPassword]
    );
    
    // Gerar token
    const tokenPayload = {
      userId: result.rows[0].id,
      email: result.rows[0].email,
      role: result.rows[0].role,
      name: result.rows[0].name
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Registro realizado com sucesso!',
      token: token,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('ERRO NO REGISTRO:', error);
    res.status(500).json({ success: false, message: 'Erro ao registrar usuário.' });
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
    },
    permissions: getUserPermissions(req.userRole)
  });
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Senha atual e nova senha são obrigatórias.' });
    }
    
    // Verificar senha atual
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
    }
    
    // Atualizar senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.userId]
    );
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso!'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Erro ao alterar senha.' });
  }
});

// ==============================================
// API - CLIENTES (COMPLETO)
// ==============================================
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', category, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM clients WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM clients WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR nif ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR nif ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      countQuery += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'email', 'total_spent', 'last_purchase', 'created_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    
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
       (SELECT COUNT(*) FROM sales WHERE client_id = c.id) as total_purchases,
       (SELECT SUM(final_amount) FROM sales WHERE client_id = c.id) as total_spent_amount,
       (SELECT MAX(sale_date) FROM sales WHERE client_id = c.id) as last_purchase_date
       FROM clients c WHERE id = $1 AND is_active = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    // Buscar histórico de compras
    const salesResult = await pool.query(
      `SELECT s.* FROM sales s 
       WHERE client_id = $1 
       ORDER BY sale_date DESC 
       LIMIT 10`,
      [id]
    );
    
    res.json({
      success: true,
      client: result.rows[0],
      recent_sales: salesResult.rows
    });
    
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
    
    // Verificar se email já existe
    if (email) {
      const existingClient = await pool.query(
        'SELECT id FROM clients WHERE email = $1 AND is_active = true',
        [email]
      );
      
      if (existingClient.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email já está em uso.' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, province, category, nif, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name.trim(), email || null, phone || null, address || null, city || null, 
       province || null, category || 'normal', nif || null, notes || null]
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
    const { name, email, phone, address, city, province, category, nif, notes, is_active } = req.body;
    
    // Verificar se cliente existe
    const clientExists = await pool.query(
      'SELECT id FROM clients WHERE id = $1',
      [id]
    );
    
    if (clientExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    // Verificar se novo email já existe
    if (email) {
      const existingClient = await pool.query(
        'SELECT id FROM clients WHERE email = $1 AND id != $2 AND is_active = true',
        [email, id]
      );
      
      if (existingClient.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email já está em uso por outro cliente.' });
      }
    }
    
    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, email = $2, phone = $3, address = $4, city = $5, 
           province = $6, category = $7, nif = $8, notes = $9, 
           is_active = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [name, email, phone, address, city, province, category, nif, notes, 
       is_active !== false, id]
    );
    
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
    
    const result = await pool.query(
      'UPDATE clients SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Cliente desativado com sucesso!',
      client_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar cliente.' });
  }
});

// Importação de clientes via CSV
app.post('/api/clients/import', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Arquivo não enviado.' });
    }
    
    const clients = [];
    const errors = [];
    
    // Ler arquivo CSV
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        clients.push(row);
      })
      .on('end', async () => {
        try {
          let imported = 0;
          let skipped = 0;
          
          for (const client of clients) {
            try {
              if (!client.name) {
                errors.push({ client, error: 'Nome é obrigatório' });
                skipped++;
                continue;
              }
              
              // Verificar se email já existe
              if (client.email) {
                const existingClient = await pool.query(
                  'SELECT id FROM clients WHERE email = $1',
                  [client.email]
                );
                
                if (existingClient.rows.length > 0) {
                  errors.push({ client, error: 'Email já existe' });
                  skipped++;
                  continue;
                }
              }
              
              await pool.query(
                `INSERT INTO clients (name, email, phone, address, city, province, category, nif, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  client.name,
                  client.email || null,
                  client.phone || null,
                  client.address || null,
                  client.city || null,
                  client.province || null,
                  client.category || 'normal',
                  client.nif || null,
                  client.notes || null
                ]
              );
              
              imported++;
            } catch (error) {
              errors.push({ client, error: error.message });
              skipped++;
            }
          }
          
          // Remover arquivo temporário
          fs.unlinkSync(req.file.path);
          
          res.json({
            success: true,
            message: 'Importação concluída!',
            summary: {
              imported,
              skipped,
              total: clients.length,
              errors: errors.slice(0, 10) // Mostrar apenas primeiros 10 erros
            }
          });
          
        } catch (error) {
          console.error('Import error:', error);
          res.status(500).json({ success: false, message: 'Erro durante importação.' });
        }
      });
    
  } catch (error) {
    console.error('Import clients error:', error);
    res.status(500).json({ success: false, message: 'Erro ao importar clientes.' });
  }
});

// ==============================================
// API - PRODUTOS (COMPLETO)
// ==============================================
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', category, low_stock = false, sortBy = 'name', sortOrder = 'ASC' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount} OR barcode ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount} OR barcode ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      countQuery += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (low_stock === 'true') {
      query += ` AND stock <= min_stock`;
      countQuery += ` AND stock <= min_stock`;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'code', 'category', 'stock', 'unit_price', 'created_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    
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

app.get('/api/products/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category, COUNT(*) as count FROM products WHERE is_active = true AND category IS NOT NULL GROUP BY category ORDER BY count DESC'
    );
    
    res.json({
      success: true,
      categories: result.rows
    });
    
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar categorias.' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT p.*,
       (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id) as total_sold,
       (SELECT SUM(quantity * unit_price) FROM sale_items WHERE product_id = p.id) as total_revenue
       FROM products p WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    // Buscar movimentações de inventário
    const movementsResult = await pool.query(
      `SELECT * FROM inventory_movements 
       WHERE product_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [id]
    );
    
    res.json({
      success: true,
      product: result.rows[0],
      movements: movementsResult.rows
    });
    
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
    
    // Verificar se código já existe
    const existingProduct = await pool.query(
      'SELECT id FROM products WHERE code = $1',
      [code]
    );
    
    if (existingProduct.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Código do produto já está em uso.' });
    }
    
    const result = await pool.query(
      `INSERT INTO products (code, name, description, category, unit_price, cost_price, stock, min_stock, supplier, barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [code, name, description || null, category || null, 
       parseFloat(unit_price), cost_price ? parseFloat(cost_price) : null,
       stock ? parseInt(stock) : 0, min_stock ? parseInt(min_stock) : 10,
       supplier || null, barcode || null]
    );
    
    // Registrar movimentação inicial
    if (stock && stock > 0) {
      await pool.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'entrada', $2, 'Stock inicial', $3)`,
        [result.rows[0].id, stock, req.userId]
      );
    }
    
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
    
    // Verificar se produto existe
    const productExists = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    // Verificar se novo código já existe
    if (code) {
      const existingProduct = await pool.query(
        'SELECT id FROM products WHERE code = $1 AND id != $2',
        [code, id]
      );
      
      if (existingProduct.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Código já está em uso por outro produto.' });
      }
    }
    
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
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Produto desativado com sucesso!',
      product_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar produto.' });
  }
});

app.patch('/api/products/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation = 'add', reason = 'Ajuste manual', notes } = req.body;
    
    if (!quantity && quantity !== 0) {
      return res.status(400).json({ success: false, message: 'Quantidade é obrigatória.' });
    }
    
    const qty = parseInt(quantity);
    
    // Verificar produto
    const productResult = await pool.query(
      'SELECT id, name, stock FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
    }
    
    let newStock;
    let movementType;
    
    switch (operation) {
      case 'add':
        newStock = productResult.rows[0].stock + qty;
        movementType = 'entrada';
        break;
      case 'subtract':
        if (productResult.rows[0].stock < qty) {
          return res.status(400).json({ 
            success: false, 
            message: `Stock insuficiente. Disponível: ${productResult.rows[0].stock}` 
          });
        }
        newStock = productResult.rows[0].stock - qty;
        movementType = 'saida';
        break;
      case 'set':
        newStock = qty;
        movementType = 'ajuste';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Operação inválida.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Atualizar stock
      const updateResult = await client.query(
        'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [newStock, id]
      );
      
      // Registrar movimentação
      await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, movementType, Math.abs(qty), reason, notes || null, req.userId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        product: updateResult.rows[0],
        movement: {
          type: movementType,
          quantity: Math.abs(qty),
          reason: reason,
          new_stock: newStock
        },
        message: `Stock ${operation === 'add' ? 'adicionado' : operation === 'subtract' ? 'removido' : 'atualizado'} com sucesso!`
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar stock.' });
  }
});

// ==============================================
// API - VENDAS (COMPLETO)
// ==============================================
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      start_date, 
      end_date, 
      client_id, 
      payment_method,
      status = 'completed',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT s.*, c.name as client_name, c.phone as client_phone, u.name as seller_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE 1=1
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM sales WHERE 1=1';
    let params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND DATE(s.sale_date) >= $${paramCount}`;
      countQuery += ` AND DATE(sale_date) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(s.sale_date) <= $${paramCount}`;
      countQuery += ` AND DATE(sale_date) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (client_id) {
      query += ` AND s.client_id = $${paramCount}`;
      countQuery += ` AND client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    if (payment_method) {
      query += ` AND s.payment_method = $${paramCount}`;
      countQuery += ` AND payment_method = $${paramCount}`;
      params.push(payment_method);
      paramCount++;
    }
    
    if (status) {
      query += ` AND s.status = $${paramCount}`;
      countQuery += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['sale_date', 'created_at', 'final_amount', 'sale_number'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY s.${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 2));
    
    // Buscar itens para cada venda
    for (let sale of result.rows) {
      const itemsResult = await pool.query(
        `SELECT si.*, p.name as product_name, p.code as product_code, p.category as product_category
         FROM sale_items si
         JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      sale.items = itemsResult.rows;
    }
    
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

app.get('/api/sales/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      `SELECT s.*, c.name as client_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE DATE(s.sale_date) = $1
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [today]
    );
    
    let total = 0;
    for (const sale of result.rows) {
      total += parseFloat(sale.final_amount);
      
      // Buscar itens
      const itemsResult = await pool.query(
        `SELECT si.*, p.name as product_name
         FROM sale_items si
         JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      sale.items = itemsResult.rows;
    }
    
    res.json({
      success: true,
      sales: result.rows,
      summary: {
        count: result.rows.length,
        total: total
      }
    });
    
  } catch (error) {
    console.error('Get today sales error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar vendas de hoje.' });
  }
});

app.get('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const saleResult = await pool.query(
      `SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone, 
              c.address as client_address, c.nif as client_nif, u.name as seller_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.seller_id = u.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venda não encontrada.' });
    }
    
    const sale = saleResult.rows[0];
    
    const itemsResult = await pool.query(
      `SELECT si.*, p.name as product_name, p.code as product_code, p.barcode as product_barcode
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [id]
    );
    
    sale.items = itemsResult.rows;
    
    res.json({
      success: true,
      sale: sale,
      receipt: {
        number: sale.sale_number,
        date: sale.sale_date,
        client: sale.client_name,
        items: sale.items,
        subtotal: sale.total_amount,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.final_amount,
        payment_method: sale.payment_method,
        amount_received: sale.amount_received,
        change: sale.amount_received ? (sale.amount_received - sale.final_amount) : 0
      }
    });
    
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
    
    // Verificar stock e calcular totais
    let subtotal = 0;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT stock, name, unit_price FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        throw new Error(`Produto ID ${item.product_id} não encontrado ou inativo`);
      }
      
      if (productResult.rows[0].stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${productResult.rows[0].name}. Disponível: ${productResult.rows[0].stock}, Solicitado: ${item.quantity}`);
      }
      
      subtotal += item.unit_price * item.quantity;
    }
    
    const final_amount = subtotal - discount + tax;
    
    if (amount_received && amount_received < final_amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Valor recebido (${amount_received}) é menor que o total (${final_amount}).` 
      });
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
      `INSERT INTO sales (sale_number, client_id, seller_id, total_amount, discount, tax, final_amount, 
                         payment_method, notes, amount_received, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
       RETURNING *`,
      [
        sale_number, 
        client_id || null, 
        req.userId,
        subtotal, 
        discount, 
        tax, 
        final_amount, 
        payment_method, 
        notes || null, 
        amount_received || final_amount
      ]
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
      
      // Registrar movimentação de inventário
      await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'saida', $2, 'Venda: ${sale_number}', $3)`,
        [item.product_id, item.quantity, req.userId]
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
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erro ao registrar venda.' 
    });
  } finally {
    client.release();
  }
});

async function getCompleteSale(saleId) {
  const saleResult = await pool.query(
    `SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
            c.address as client_address, u.name as seller_name
     FROM sales s
     LEFT JOIN clients c ON s.client_id = c.id
     LEFT JOIN users u ON s.seller_id = u.id
     WHERE s.id = $1`,
    [saleId]
  );
  
  if (saleResult.rows.length === 0) return null;
  
  const sale = saleResult.rows[0];
  
  const itemsResult = await pool.query(
    `SELECT si.*, p.name as product_name, p.code as product_code, p.barcode as product_barcode
     FROM sale_items si
     JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = $1`,
    [saleId]
  );
  
  sale.items = itemsResult.rows;
  return sale;
}

// Cancelar venda
app.post('/api/sales/:id/cancel', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { reason } = req.body;
    
    // Buscar venda
    const saleResult = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND status = $2',
      [id, 'completed']
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Venda não encontrada ou já cancelada.' });
    }
    
    const sale = saleResult.rows[0];
    
    // Buscar itens da venda
    const itemsResult = await client.query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [id]
    );
    
    // Reverter stock
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
      
      // Registrar movimentação
      await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, 'entrada', $2, $3, $4)`,
        [item.product_id, item.quantity, `Cancelamento venda ${sale.sale_number}: ${reason || 'Sem motivo'}`, req.userId]
      );
    }
    
    // Atualizar cliente
    if (sale.client_id) {
      await client.query(
        'UPDATE clients SET total_spent = total_spent - $1 WHERE id = $2',
        [sale.final_amount, sale.client_id]
      );
    }
    
    // Cancelar venda
    await client.query(
      'UPDATE sales SET status = $1, notes = CONCAT(notes, $2) WHERE id = $3',
      ['cancelled', `\n\nCANCELADA em ${new Date().toISOString()} - Motivo: ${reason || 'Não informado'}`, id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Venda cancelada com sucesso!',
      sale_id: id
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel sale error:', error);
    res.status(500).json({ success: false, message: 'Erro ao cancelar venda.' });
  } finally {
    client.release();
  }
});

// ==============================================
// API - DASHBOARD (COMPLETO)
// ==============================================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    // Vendas do dia
    const salesTodayResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total 
       FROM sales 
       WHERE DATE(sale_date) = $1 AND status = 'completed'`,
      [today]
    );
    
    // Vendas de ontem
    const salesYesterdayResult = await pool.query(
      `SELECT COALESCE(SUM(final_amount), 0) as total 
       FROM sales 
       WHERE DATE(sale_date) = $1 AND status = 'completed'`,
      [yesterday]
    );
    
    // Total de clientes
    const clientsResult = await pool.query(
      'SELECT COUNT(*) as count FROM clients WHERE is_active = true'
    );
    
    // Produtos com stock baixo
    const lowStockResult = await pool.query(
      `SELECT COUNT(*) as count FROM products 
       WHERE is_active = true AND stock <= min_stock`
    );
    
    // Vendas do mês
    const monthlySalesResult = await pool.query(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM(final_amount), 0) as total,
         COALESCE(AVG(final_amount), 0) as average
       FROM sales 
       WHERE DATE(sale_date) >= $1 AND status = 'completed'`,
      [firstDayOfMonth]
    );
    
    // Total de produtos
    const productsResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true'
    );
    
    // Valor total em stock
    const stockValueResult = await pool.query(
      `SELECT COALESCE(SUM(stock * cost_price), 0) as value 
       FROM products 
       WHERE is_active = true AND cost_price IS NOT NULL`
    );
    
    // Vendas dos últimos 7 dias para gráfico
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);
    const startDate = last7Days.toISOString().split('T')[0];
    
    const last7DaysSalesResult = await pool.query(
      `SELECT 
         DATE(sale_date) as date,
         COUNT(*) as sales_count,
         COALESCE(SUM(final_amount), 0) as revenue
       FROM sales 
       WHERE DATE(sale_date) >= $1 AND status = 'completed'
       GROUP BY DATE(sale_date)
       ORDER BY DATE(sale_date)`,
      [startDate]
    );
    
    // Produtos mais vendidos do mês
    const topProductsResult = await pool.query(
      `SELECT 
         p.name as product_name,
         p.code as product_code,
         SUM(si.quantity) as quantity_sold,
         SUM(si.total_price) as revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       JOIN sales s ON si.sale_id = s.id
       WHERE DATE(s.sale_date) >= $1 AND s.status = 'completed'
       GROUP BY p.id, p.name, p.code
       ORDER BY quantity_sold DESC
       LIMIT 5`,
      [firstDayOfMonth]
    );
    
    // Clientes que mais compram
    const topClientsResult = await pool.query(
      `SELECT 
         c.name as client_name,
         COUNT(s.id) as purchase_count,
         COALESCE(SUM(s.final_amount), 0) as total_spent
       FROM clients c
       LEFT JOIN sales s ON c.id = s.client_id
       WHERE s.status = 'completed'
       GROUP BY c.id, c.name
       ORDER BY total_spent DESC
       LIMIT 5`
    );
    
    res.json({
      success: true,
      stats: {
        // Cards principais
        sales_today: {
          count: parseInt(salesTodayResult.rows[0].count),
          total: parseFloat(salesTodayResult.rows[0].total),
          yesterday_comparison: parseFloat(salesYesterdayResult.rows[0].total)
        },
        total_clients: parseInt(clientsResult.rows[0].count),
        low_stock_products: parseInt(lowStockResult.rows[0].count),
        monthly_revenue: parseFloat(monthlySalesResult.rows[0].total),
        total_products: parseInt(productsResult.rows[0].count),
        stock_value: parseFloat(stockValueResult.rows[0].value),
        avg_monthly_sale: parseFloat(monthlySalesResult.rows[0].average),
        
        // Gráficos e listas
        last_7_days: last7DaysSalesResult.rows,
        top_products: topProductsResult.rows,
        top_clients: topClientsResult.rows,
        
        // Insights
        insights: {
          best_selling_category: await getBestSellingCategory(),
          peak_sales_hour: await getPeakSalesHour(),
          inventory_health: await getInventoryHealth()
        }
      }
    });
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar estatísticas do dashboard.' });
  }
});

async function getBestSellingCategory() {
  try {
    const result = await pool.query(
      `SELECT 
         p.category,
         SUM(si.quantity) as total_quantity,
         SUM(si.total_price) as total_revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       JOIN sales s ON si.sale_id = s.id
       WHERE p.category IS NOT NULL AND s.status = 'completed'
         AND DATE(s.sale_date) >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY p.category
       ORDER BY total_revenue DESC
       LIMIT 1`
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

async function getPeakSalesHour() {
  try {
    const result = await pool.query(
      `SELECT 
         EXTRACT(HOUR FROM sale_date) as hour,
         COUNT(*) as sales_count
       FROM sales
       WHERE status = 'completed'
         AND DATE(sale_date) >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY EXTRACT(HOUR FROM sale_date)
       ORDER BY sales_count DESC
       LIMIT 1`
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

async function getInventoryHealth() {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_products,
         SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
         SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) as low_stock,
         SUM(CASE WHEN stock > min_stock * 2 THEN 1 ELSE 0 END) as high_stock
       FROM products
       WHERE is_active = true`
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

// ==============================================
// API - RELATÓRIOS (COMPLETO)
// ==============================================
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day', client_id, payment_method } = req.query;
    
    let dateField, groupClause;
    
    switch (group_by) {
      case 'week':
        dateField = "DATE_TRUNC('week', sale_date)";
        groupClause = "DATE_TRUNC('week', sale_date)";
        break;
      case 'month':
        dateField = "DATE_TRUNC('month', sale_date)";
        groupClause = "DATE_TRUNC('month', sale_date)";
        break;
      case 'year':
        dateField = "DATE_TRUNC('year', sale_date)";
        groupClause = "DATE_TRUNC('year', sale_date)";
        break;
      case 'day':
      default:
        dateField = 'DATE(sale_date)';
        groupClause = 'DATE(sale_date)';
        break;
    }
    
    let query = `
      SELECT 
        ${dateField} as period,
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_value,
        MIN(final_amount) as min_sale,
        MAX(final_amount) as max_sale
      FROM sales
      WHERE status = 'completed'
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
    
    if (client_id) {
      query += ` AND client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    if (payment_method) {
      query += ` AND payment_method = $${paramCount}`;
      params.push(payment_method);
      paramCount++;
    }
    
    query += ` GROUP BY ${groupClause} ORDER BY ${groupClause} DESC`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_value,
        MIN(final_amount) as min_sale,
        MAX(final_amount) as max_sale,
        COUNT(DISTINCT client_id) as unique_clients,
        SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END) as cash_total,
        SUM(CASE WHEN payment_method = 'card' THEN final_amount ELSE 0 END) as card_total,
        SUM(CASE WHEN payment_method = 'transfer' THEN final_amount ELSE 0 END) as transfer_total
      FROM sales
      WHERE status = 'completed'
      ${start_date ? ` AND DATE(sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
    `;
    
    const statsResult = await pool.query(statsQuery, params);
    
    // Produtos mais vendidos
    const topProductsQuery = `
      SELECT 
        p.name as product_name,
        p.code as product_code,
        p.category as product_category,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_price
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY p.id, p.name, p.code, p.category
      ORDER BY total_quantity DESC
      LIMIT 10
    `;
    
    const topProductsResult = await pool.query(topProductsQuery, params);
    
    // Métodos de pagamento
    const paymentMethodsQuery = `
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(final_amount) as total
      FROM sales
      WHERE status = 'completed'
      ${start_date ? ` AND DATE(sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY payment_method
      ORDER BY total DESC
    `;
    
    const paymentMethodsResult = await pool.query(paymentMethodsQuery, params);
    
    res.json({
      success: true,
      report: {
        summary: result.rows,
        statistics: statsResult.rows[0],
        top_products: topProductsResult.rows,
        payment_methods: paymentMethodsResult.rows
      }
    });
    
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendas.' });
  }
});

app.get('/api/reports/products', authenticateToken, async (req, res) => {
  try {
    const { category, low_stock = false } = req.query;
    
    let query = `
      SELECT 
        p.*,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        (SELECT COUNT(*) FROM inventory_movements WHERE product_id = p.id) as movement_count
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
      WHERE p.is_active = true
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (low_stock === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    query += ` GROUP BY p.id ORDER BY p.stock ASC`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas por categoria
    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as total_products,
        SUM(stock) as total_stock,
        AVG(unit_price) as avg_price,
        SUM(stock * cost_price) as total_value,
        SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END) as low_stock_count
      FROM products
      WHERE is_active = true
      GROUP BY category
      ORDER BY total_value DESC
    `;
    
    const categoryStatsResult = await pool.query(categoryStatsQuery);
    
    // Valor total do inventário
    const totalValueQuery = `
      SELECT 
        SUM(stock * cost_price) as total_cost_value,
        SUM(stock * unit_price) as total_sale_value
      FROM products 
      WHERE is_active = true
    `;
    const totalValueResult = await pool.query(totalValueQuery);
    
    res.json({
      success: true,
      report: {
        products: result.rows,
        category_stats: categoryStatsResult.rows,
        summary: {
          total_products: result.rows.length,
          total_cost_value: totalValueResult.rows[0].total_cost_value || 0,
          total_sale_value: totalValueResult.rows[0].total_sale_value || 0,
          low_stock_count: result.rows.filter(p => p.stock <= p.min_stock).length
        }
      }
    });
    
  } catch (error) {
    console.error('Get products report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório de produtos.' });
  }
});

app.get('/api/reports/clients', authenticateToken, async (req, res) => {
  try {
    const { category, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        c.*,
        COUNT(s.id) as total_purchases,
        COALESCE(SUM(s.final_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date,
        AVG(s.final_amount) as avg_purchase_value,
        MIN(s.sale_date) as first_purchase_date
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.status = 'completed'
      WHERE c.is_active = true
    `;
    
    let params = [];
    let paramCount = 1;
    
    if (category) {
      query += ` AND c.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND s.sale_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND s.sale_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    query += ` GROUP BY c.id ORDER BY total_spent DESC`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas por categoria
    const categoryStatsQuery = `
      SELECT 
        c.category,
        COUNT(DISTINCT c.id) as total_clients,
        COUNT(DISTINCT CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN c.id END) as active_clients,
        COALESCE(AVG(s.final_amount), 0) as avg_spent,
        COALESCE(SUM(s.final_amount), 0) as total_revenue
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.status = 'completed'
      WHERE c.is_active = true
      ${start_date ? ` AND s.sale_date >= $${paramCount}` : ''}
      ${end_date ? ` AND s.sale_date <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY c.category
    `;
    
    const categoryStatsResult = await pool.query(categoryStatsQuery, params);
    
    res.json({
      success: true,
      report: {
        clients: result.rows,
        category_stats: categoryStatsResult.rows,
        summary: {
          total_clients: result.rows.length,
          active_clients: result.rows.filter(c => 
            c.last_purchase_date && 
            new Date(c.last_purchase_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length,
          top_spender: result.rows.length > 0 ? result.rows[0] : null
        }
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
        SUM(final_amount) as revenue,
        SUM(tax) as tax_collected,
        SUM(discount) as total_discounts
      FROM sales
      WHERE status = 'completed'
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
        SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7)) as cost_of_goods_sold
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed'
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY DATE_TRUNC('month', s.sale_date)
      ORDER BY DATE_TRUNC('month', s.sale_date) DESC
    `;
    
    const cogsResult = await pool.query(cogsQuery, start_date || end_date ? params : []);
    
    // Margens por produto
    const marginQuery = `
      SELECT 
        p.name as product_name,
        p.code as product_code,
        SUM(si.quantity) as quantity_sold,
        SUM(si.total_price) as revenue,
        SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7)) as cost,
        (SUM(si.total_price) - SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7))) as profit,
        ROUND(((SUM(si.total_price) - SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7))) / SUM(si.total_price) * 100), 2) as margin_percentage
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
      GROUP BY p.id, p.name, p.code
      ORDER BY profit DESC
      LIMIT 20
    `;
    
    const marginResult = await pool.query(marginQuery, start_date || end_date ? params : []);
    
    // Resumo financeiro
    const summaryQuery = `
      SELECT 
        SUM(s.final_amount) as total_revenue,
        SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7)) as total_cogs,
        SUM(s.tax) as total_tax,
        SUM(s.discount) as total_discount,
        COUNT(DISTINCT s.client_id) as total_clients,
        COUNT(DISTINCT s.id) as total_sales,
        AVG(s.final_amount) as avg_sale_value,
        (SUM(s.final_amount) - SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7))) as gross_profit,
        ROUND(((SUM(s.final_amount) - SUM(si.quantity * COALESCE(p.cost_price, p.unit_price * 0.7))) / SUM(s.final_amount) * 100), 2) as gross_margin
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed'
      ${start_date ? ` AND DATE(s.sale_date) >= $${paramCount}` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${paramCount + (start_date ? 1 : 0)}` : ''}
    `;
    
    const summaryResult = await pool.query(summaryQuery, start_date || end_date ? params : []);
    
    res.json({
      success: true,
      report: {
        monthly_revenue: salesResult.rows,
        monthly_cogs: cogsResult.rows,
        product_margins: marginResult.rows,
        summary: summaryResult.rows[0] || {},
        analysis: {
          best_margin_product: marginResult.rows.length > 0 ? marginResult.rows[0] : null,
          worst_margin_product: marginResult.rows.length > 0 ? marginResult.rows[marginResult.rows.length - 1] : null,
          revenue_trend: await calculateRevenueTrend(),
          seasonality: await detectSeasonality()
        }
      }
    });
    
  } catch (error) {
    console.error('Get financial report error:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório financeiro.' });
  }
});

async function calculateRevenueTrend() {
  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('month', sale_date) as month,
        SUM(final_amount) as revenue
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '6 months'
        AND status = 'completed'
      GROUP BY DATE_TRUNC('month', sale_date)
      ORDER BY DATE_TRUNC('month', sale_date)
    `);
    
    if (result.rows.length < 2) return 'insufficient_data';
    
    const lastMonth = result.rows[result.rows.length - 1];
    const prevMonth = result.rows[result.rows.length - 2];
    
    const growth = ((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100;
    
    if (growth > 10) return 'strong_growth';
    if (growth > 0) return 'moderate_growth';
    if (growth > -10) return 'stable';
    return 'decline';
    
  } catch (error) {
    return 'unknown';
  }
}

async function detectSeasonality() {
  try {
    const result = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM sale_date) as month,
        SUM(final_amount) as revenue
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '2 years'
        AND status = 'completed'
      GROUP BY EXTRACT(MONTH FROM sale_date)
      ORDER BY EXTRACT(MONTH FROM sale_date)
    `);
    
    return result.rows;
  } catch (error) {
    return [];
  }
}

// ==============================================
// API - FORNECEDORES (COMPLETO)
// ==============================================
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', sortBy = 'name', sortOrder = 'ASC' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM suppliers WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM suppliers WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR contact ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR contact ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'rating', 'created_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    
    // Buscar produtos dos fornecedores
    for (let supplier of result.rows) {
      const productsResult = await pool.query(
        'SELECT id, name, code, stock, unit_price FROM products WHERE supplier = $1 AND is_active = true LIMIT 10',
        [supplier.name]
      );
      supplier.products = productsResult.rows;
    }
    
    res.json({
      success: true,
      suppliers: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar fornecedores.' });
  }
});

app.get('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
    }
    
    const supplier = result.rows[0];
    
    // Buscar produtos deste fornecedor
    const productsResult = await pool.query(
      'SELECT * FROM products WHERE supplier = $1 AND is_active = true ORDER BY name',
      [supplier.name]
    );
    
    // Buscar compras deste fornecedor
    const purchasesResult = await pool.query(
      `SELECT 
         im.*,
         p.name as product_name,
         p.code as product_code,
         u.name as user_name
       FROM inventory_movements im
       JOIN products p ON im.product_id = p.id
       LEFT JOIN users u ON im.user_id = u.id
       WHERE p.supplier = $1 AND im.type = 'entrada'
       ORDER BY im.created_at DESC
       LIMIT 20`,
      [supplier.name]
    );
    
    res.json({
      success: true,
      supplier: supplier,
      products: productsResult.rows,
      purchases: purchasesResult.rows
    });
    
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar fornecedor.' });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { name, contact, email, address, products, rating } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
    }
    
    // Verificar se fornecedor já existe
    const existingSupplier = await pool.query(
      'SELECT id FROM suppliers WHERE name = $1 AND is_active = true',
      [name]
    );
    
    if (existingSupplier.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Fornecedor com este nome já existe.' });
    }
    
    const result = await pool.query(
      `INSERT INTO suppliers (name, contact, email, address, products, rating)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), contact || null, email || null, address || null, 
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

app.put('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, email, address, products, rating, is_active } = req.body;
    
    // Verificar se fornecedor existe
    const supplierExists = await pool.query(
      'SELECT id FROM suppliers WHERE id = $1',
      [id]
    );
    
    if (supplierExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
    }
    
    // Verificar se novo nome já existe
    if (name) {
      const existingSupplier = await pool.query(
        'SELECT id FROM suppliers WHERE name = $1 AND id != $2 AND is_active = true',
        [name, id]
      );
      
      if (existingSupplier.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Nome já está em uso por outro fornecedor.' });
      }
    }
    
    const result = await pool.query(
      `UPDATE suppliers 
       SET name = $1, contact = $2, email = $3, address = $4, products = $5, rating = $6,
           is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, contact, email, address, 
       Array.isArray(products) ? products : [products || ''], 
       rating || 0, is_active !== false, id]
    );
    
    res.json({
      success: true,
      supplier: result.rows[0],
      message: 'Fornecedor atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar fornecedor.' });
  }
});

app.delete('/api/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE suppliers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Fornecedor desativado com sucesso!',
      supplier_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar fornecedor.' });
  }
});

// ==============================================
// API - EQUIPA (COMPLETO)
// ==============================================
app.get('/api/team', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role, sortBy = 'name', sortOrder = 'ASC' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM team WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM team WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR contact ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR contact ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (role) {
      query += ` AND role = $${paramCount}`;
      countQuery += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'role', 'join_date', 'created_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    
    // Calcular estatísticas para cada membro
    for (let member of result.rows) {
      // Vendas realizadas
      const salesResult = await pool.query(
        `SELECT 
           COUNT(*) as total_sales,
           SUM(final_amount) as total_amount,
           AVG(final_amount) as avg_sale_value
         FROM sales 
         WHERE seller_id = (SELECT id FROM users WHERE email = $1 LIMIT 1)
           AND status = 'completed'`,
        [member.email]
      );
      
      member.sales_stats = salesResult.rows[0] || {
        total_sales: 0,
        total_amount: 0,
        avg_sale_value: 0
      };
    }
    
    res.json({
      success: true,
      team: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar equipa.' });
  }
});

app.get('/api/team/roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT role FROM team WHERE is_active = true ORDER BY role'
    );
    
    res.json({
      success: true,
      roles: result.rows.map(r => r.role)
    });
    
  } catch (error) {
    console.error('Get team roles error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar cargos.' });
  }
});

app.get('/api/team/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM team WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Membro não encontrado.' });
    }
    
    const member = result.rows[0];
    
    // Buscar vendas realizadas
    const salesResult = await pool.query(
      `SELECT s.*, c.name as client_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.seller_id = (SELECT id FROM users WHERE email = $1 LIMIT 1)
         AND s.status = 'completed'
       ORDER BY s.sale_date DESC
       LIMIT 20`,
      [member.email]
    );
    
    // Estatísticas detalhadas
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_sales,
         SUM(final_amount) as total_amount,
         AVG(final_amount) as avg_sale_value,
         MIN(final_amount) as min_sale_value,
         MAX(final_amount) as max_sale_value,
         COUNT(DISTINCT client_id) as unique_clients,
         SUM(CASE WHEN DATE(sale_date) = CURRENT_DATE THEN final_amount ELSE 0 END) as today_sales,
         SUM(CASE WHEN DATE(sale_date) = CURRENT_DATE - INTERVAL '1 day' THEN final_amount ELSE 0 END) as yesterday_sales
       FROM sales
       WHERE seller_id = (SELECT id FROM users WHERE email = $1 LIMIT 1)
         AND status = 'completed'`,
      [member.email]
    );
    
    member.sales = salesResult.rows;
    member.stats = statsResult.rows[0] || {};
    
    res.json({
      success: true,
      member: member
    });
    
  } catch (error) {
    console.error('Get team member error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar membro da equipa.' });
  }
});

app.post('/api/team', authenticateToken, async (req, res) => {
  try {
    const { name, role, contact, email, join_date, salary } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Nome e cargo são obrigatórios.' });
    }
    
    // Verificar se email já está em uso
    if (email) {
      const existingMember = await pool.query(
        'SELECT id FROM team WHERE email = $1 AND is_active = true',
        [email]
      );
      
      if (existingMember.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email já está em uso.' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO team (name, role, contact, email, join_date, salary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(), 
        role.trim(), 
        contact || null, 
        email || null, 
        join_date || new Date().toISOString().split('T')[0],
        salary || null
      ]
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

app.put('/api/team/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, contact, email, join_date, salary, is_active } = req.body;
    
    // Verificar se membro existe
    const memberExists = await pool.query(
      'SELECT id FROM team WHERE id = $1',
      [id]
    );
    
    if (memberExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Membro não encontrado.' });
    }
    
    // Verificar se novo email já existe
    if (email) {
      const existingMember = await pool.query(
        'SELECT id FROM team WHERE email = $1 AND id != $2 AND is_active = true',
        [email, id]
      );
      
      if (existingMember.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email já está em uso por outro membro.' });
      }
    }
    
    const result = await pool.query(
      `UPDATE team 
       SET name = $1, role = $2, contact = $3, email = $4, join_date = $5, salary = $6,
           is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, role, contact, email, join_date, salary, is_active !== false, id]
    );
    
    res.json({
      success: true,
      member: result.rows[0],
      message: 'Membro da equipa atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar membro da equipa.' });
  }
});

app.delete('/api/team/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE team SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Membro não encontrado.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Membro da equipa desativado com sucesso!',
      member_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Delete team member error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar membro da equipa.' });
  }
});

// ==============================================
// API - INVENTÁRIO (COMPLETO)
// ==============================================
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { low_stock = false, category, sortBy = 'stock', sortOrder = 'ASC' } = req.query;
    
    let query = `
      SELECT 
        p.*,
        (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id) as total_sold,
        (SELECT COUNT(*) FROM inventory_movements WHERE product_id = p.id) as movement_count
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
    
    // Ordenação segura
    const validSortColumns = ['stock', 'name', 'code', 'unit_price', 'category'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'stock';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${order}`;
    
    const result = await pool.query(query, params);
    
    // Valor total em stock
    const totalValueQuery = `
      SELECT 
        SUM(stock * COALESCE(cost_price, unit_price * 0.7)) as total_cost_value,
        SUM(stock * unit_price) as total_sale_value
      FROM products 
      WHERE is_active = true
    `;
    const totalValueResult = await pool.query(totalValueQuery);
    
    // Produtos que precisam de reposição
    const reorderQuery = `
      SELECT 
        COUNT(*) as need_reorder,
        SUM(min_stock - stock) as total_to_order
      FROM products 
      WHERE is_active = true AND stock < min_stock
    `;
    const reorderResult = await pool.query(reorderQuery);
    
    // Categorias com stock baixo
    const categoryLowStockQuery = `
      SELECT 
        category,
        COUNT(*) as low_stock_count,
        SUM(min_stock - stock) as deficit
      FROM products
      WHERE is_active = true AND stock < min_stock AND category IS NOT NULL
      GROUP BY category
      ORDER BY deficit DESC
    `;
    const categoryLowStockResult = await pool.query(categoryLowStockQuery);
    
    res.json({
      success: true,
      inventory: result.rows,
      summary: {
        total_products: result.rows.length,
        total_cost_value: totalValueResult.rows[0].total_cost_value || 0,
        total_sale_value: totalValueResult.rows[0].total_sale_value || 0,
        need_reorder: reorderResult.rows[0].need_reorder || 0,
        total_to_order: reorderResult.rows[0].total_to_order || 0,
        low_stock_count: result.rows.filter(p => p.stock <= p.min_stock).length,
        out_of_stock_count: result.rows.filter(p => p.stock === 0).length,
        category_low_stock: categoryLowStockResult.rows
      }
    });
    
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar inventário.' });
  }
});

app.get('/api/inventory/movements', authenticateToken, async (req, res) => {
  try {
    const { product_id, type, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        im.*,
        p.name as product_name,
        p.code as product_code,
        u.name as user_name,
        u.email as user_email
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      WHERE 1=1
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM inventory_movements im WHERE 1=1';
    let params = [];
    let paramCount = 1;
    
    if (product_id) {
      query += ` AND im.product_id = $${paramCount}`;
      countQuery += ` AND im.product_id = $${paramCount}`;
      params.push(product_id);
      paramCount++;
    }
    
    if (type) {
      query += ` AND im.type = $${paramCount}`;
      countQuery += ` AND im.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND DATE(im.created_at) >= $${paramCount}`;
      countQuery += ` AND DATE(im.created_at) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(im.created_at) <= $${paramCount}`;
      countQuery += ` AND DATE(im.created_at) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    query += ` ORDER BY im.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 2));
    
    // Estatísticas de movimentação
    const statsQuery = `
      SELECT 
        type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity
      FROM inventory_movements
      WHERE 1=1
      ${product_id ? ` AND product_id = $1` : ''}
      ${start_date ? ` AND DATE(created_at) >= $${product_id ? 2 : 1}` : ''}
      ${end_date ? ` AND DATE(created_at) <= $${(product_id ? 2 : 1) + (start_date ? 1 : 0)}` : ''}
      GROUP BY type
      ORDER BY type
    `;
    
    const statsParams = [];
    if (product_id) statsParams.push(product_id);
    if (start_date) statsParams.push(start_date);
    if (end_date) statsParams.push(end_date);
    
    const statsResult = await pool.query(statsQuery, statsParams);
    
    res.json({
      success: true,
      movements: result.rows,
      statistics: statsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
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
    
    const validTypes = ['entrada', 'saida', 'ajuste'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo de movimentação inválido.' });
    }
    
    const qty = parseInt(quantity);
    if (qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantidade deve ser maior que zero.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar produto
      const productResult = await client.query(
        'SELECT id, name, stock FROM products WHERE id = $1 AND is_active = true',
        [product_id]
      );
      
      if (productResult.rows.length === 0) {
        throw new Error('Produto não encontrado ou inativo');
      }
      
      const product = productResult.rows[0];
      
      // Verificar stock para saídas
      if (type === 'saida' && product.stock < qty) {
        throw new Error(`Stock insuficiente. Disponível: ${product.stock}`);
      }
      
      // Criar movimentação
      const movementResult = await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [product_id, type, qty, reason || null, notes || null, req.userId]
      );
      
      // Atualizar stock do produto
      let newStock;
      switch (type) {
        case 'entrada':
          newStock = product.stock + qty;
          await client.query(
            'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStock, product_id]
          );
          break;
        case 'saida':
          newStock = product.stock - qty;
          await client.query(
            'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStock, product_id]
          );
          break;
        case 'ajuste':
          newStock = qty;
          await client.query(
            'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStock, product_id]
          );
          break;
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        movement: movementResult.rows[0],
        product: {
          id: product_id,
          name: product.name,
          old_stock: product.stock,
          new_stock: newStock
        },
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
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erro ao registrar movimentação de inventário.' 
    });
  }
});

app.get('/api/inventory/alerts', authenticateToken, async (req, res) => {
  try {
    // Produtos com stock baixo
    const lowStockResult = await pool.query(
      `SELECT 
         p.*,
         (p.min_stock - p.stock) as deficit
       FROM products p
       WHERE p.is_active = true 
         AND p.stock <= p.min_stock
       ORDER BY deficit DESC
       LIMIT 20`
    );
    
    // Produtos sem movimentação há mais de 30 dias
    const inactiveProductsResult = await pool.query(
      `SELECT 
         p.*,
         EXTRACT(DAY FROM NOW() - COALESCE((SELECT MAX(created_at) FROM inventory_movements WHERE product_id = p.id), p.created_at)) as days_inactive
       FROM products p
       WHERE p.is_active = true 
         AND (p.stock > 0 OR p.min_stock > 0)
         AND COALESCE((SELECT MAX(created_at) FROM inventory_movements WHERE product_id = p.id), p.created_at) < NOW() - INTERVAL '30 days'
       ORDER BY days_inactive DESC
       LIMIT 10`
    );
    
    // Produtos perto da validade (exemplo - implementar se tiver campo expiry_date)
    const nearExpiryResult = await pool.query(
      `SELECT 
         p.*,
         (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id AND created_at >= CURRENT_DATE - INTERVAL '7 days') as weekly_sales
       FROM products p
       WHERE p.is_active = true 
         AND p.stock > 0
       ORDER BY p.stock ASC
       LIMIT 10`
    );
    
    res.json({
      success: true,
      alerts: {
        low_stock: lowStockResult.rows,
        inactive_products: inactiveProductsResult.rows,
        near_expiry: nearExpiryResult.rows,
        summary: {
          low_stock_count: lowStockResult.rows.length,
          inactive_count: inactiveProductsResult.rows.length,
          total_alerts: lowStockResult.rows.length + inactiveProductsResult.rows.length + nearExpiryResult.rows.length
        }
      }
    });
    
  } catch (error) {
    console.error('Get inventory alerts error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar alertas de inventário.' });
  }
});

// ==============================================
// API - ENCOMENDAS (COMPLETO)
// ==============================================
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 50, 
      start_date, 
      end_date,
      client_id,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*, c.name as client_name, c.phone as client_phone, c.email as client_email
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE 1=1
    `;
    
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE 1=1';
    let params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND o.status = $${paramCount}`;
      countQuery += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (start_date) {
      query += ` AND DATE(o.created_at) >= $${paramCount}`;
      countQuery += ` AND DATE(created_at) >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND DATE(o.created_at) <= $${paramCount}`;
      countQuery += ` AND DATE(created_at) <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (client_id) {
      query += ` AND o.client_id = $${paramCount}`;
      countQuery += ` AND client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['created_at', 'delivery_date', 'total_amount', 'status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY o.${sortColumn} ${order} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 2));
    
    // Buscar itens das encomendas
    for (let order of result.rows) {
      const itemsResult = await pool.query(
        `SELECT oi.*, p.name as product_name, p.code as product_code, p.stock as current_stock
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsResult.rows;
    }
    
    // Estatísticas de status
    const statusStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_value
      FROM orders
      GROUP BY status
      ORDER BY status
    `;
    
    const statusStatsResult = await pool.query(statusStatsQuery);
    
    res.json({
      success: true,
      orders: result.rows,
      status_stats: statusStatsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar encomendas.' });
  }
});

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const orderResult = await pool.query(
      `SELECT o.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
              c.address as client_address, c.city as client_city, c.province as client_province
       FROM orders o
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Encomenda não encontrada.' });
    }
    
    const order = orderResult.rows[0];
    
    const itemsResult = await pool.query(
      `SELECT oi.*, p.name as product_name, p.code as product_code, p.stock as current_stock,
              p.unit_price as current_price, p.min_stock
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );
    
    order.items = itemsResult.rows;
    
    // Histórico de status (se tiver tabela order_status_history)
    const historyResult = await pool.query(
      `SELECT * FROM order_status_history 
       WHERE order_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    
    order.history = historyResult.rows;
    
    res.json({
      success: true,
      order: order
    });
    
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar encomenda.' });
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
      
      // Verificar disponibilidade dos produtos
      let total = 0;
      const unavailableItems = [];
      
      for (const item of items) {
        const productResult = await client.query(
          'SELECT id, name, stock, unit_price FROM products WHERE id = $1 AND is_active = true',
          [item.product_id]
        );
        
        if (productResult.rows.length === 0) {
          unavailableItems.push({ product_id: item.product_id, reason: 'Produto não encontrado ou inativo' });
          continue;
        }
        
        const product = productResult.rows[0];
        
        // Verificar stock se for necessário
        if (item.quantity > product.stock) {
          unavailableItems.push({ 
            product_id: item.product_id, 
            product_name: product.name,
            requested: item.quantity, 
            available: product.stock,
            reason: 'Stock insuficiente' 
          });
        }
        
        const unitPrice = item.unit_price || product.unit_price;
        total += unitPrice * item.quantity;
      }
      
      if (unavailableItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Alguns produtos não estão disponíveis',
          unavailable_items: unavailableItems
        });
      }
      
      // Gerar número da encomenda
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const countResult = await client.query(
        'SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE'
      );
      const dailyCount = parseInt(countResult.rows[0].count) + 1;
      
      const order_number = `ORD${year}${month}${day}${String(dailyCount).padStart(4, '0')}`;
      
      // Criar encomenda
      const orderResult = await client.query(
        `INSERT INTO orders (order_number, client_id, total_amount, delivery_date, notes, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [order_number, client_id || null, total, delivery_date || null, notes || null]
      );
      
      const order = orderResult.rows[0];
      
      // Adicionar itens
      for (const item of items) {
        const productResult = await client.query(
          'SELECT unit_price FROM products WHERE id = $1',
          [item.product_id]
        );
        
        const unitPrice = item.unit_price || productResult.rows[0].unit_price;
        
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.product_id, item.quantity, unitPrice, unitPrice * item.quantity]
        );
      }
      
      // Registrar histórico
      await client.query(
        `INSERT INTO order_status_history (order_id, status, notes, user_id)
         VALUES ($1, 'pending', 'Encomenda criada', $2)`,
        [order.id, req.userId]
      );
      
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
    const { status, notes } = req.body;
    
    const validStatuses = ['pending', 'processing', 'completed', 'cancelled', 'delivered'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inválido.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Buscar encomenda atual
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Encomenda não encontrada.' });
      }
      
      const order = orderResult.rows[0];
      
      // Atualizar status
      const updateResult = await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      
      // Registrar histórico
      await client.query(
        `INSERT INTO order_status_history (order_id, status, notes, user_id)
         VALUES ($1, $2, $3, $4)`,
        [id, status, notes || `Status alterado para ${status}`, req.userId]
      );
      
      // Se a encomenda foi completada ou entregue, atualizar stock
      if (status === 'completed' || status === 'delivered') {
        const itemsResult = await client.query(
          'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
          [id]
        );
        
        for (const item of itemsResult.rows) {
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
          
          // Registrar movimentação de inventário
          await client.query(
            `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
             VALUES ($1, 'saida', $2, 'Encomenda ${order.order_number} ${status}', $3)`,
            [item.product_id, item.quantity, req.userId]
          );
        }
      }
      
      // Se a encomenda foi cancelada e tinha sido processada, reverter stock
      if (status === 'cancelled' && (order.status === 'completed' || order.status === 'delivered')) {
        const itemsResult = await client.query(
          'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
          [id]
        );
        
        for (const item of itemsResult.rows) {
          await client.query(
            'UPDATE products SET stock = stock + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
          
          // Registrar movimentação de inventário
          await client.query(
            `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
             VALUES ($1, 'entrada', $2, 'Cancelamento encomenda ${order.order_number}', $3)`,
            [item.product_id, item.quantity, req.userId]
          );
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        order: updateResult.rows[0],
        message: `Encomenda ${status === 'completed' ? 'completada' : 'atualizada'} com sucesso!`
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar encomenda.' });
  }
});

app.put('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, delivery_date, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE orders 
       SET client_id = $1, delivery_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [client_id, delivery_date, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Encomenda não encontrada.' });
    }
    
    res.json({
      success: true,
      order: result.rows[0],
      message: 'Encomenda atualizada com sucesso!'
    });
    
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar encomenda.' });
  }
});

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se pode ser excluída (apenas pendentes)
    const orderResult = await pool.query(
      'SELECT status FROM orders WHERE id = $1',
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Encomenda não encontrada.' });
    }
    
    if (orderResult.rows[0].status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Apenas encomendas pendentes podem ser excluídas.' 
      });
    }
    
    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING id',
      [id]
    );
    
    res.json({ 
      success: true, 
      message: 'Encomenda excluída com sucesso!',
      order_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao excluir encomenda.' });
  }
});

// ==============================================
// API - CONFIGURAÇÕES (COMPLETO)
// ==============================================
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY key');
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    // Configurações padrão se não existirem
    const defaultSettings = {
      company_name: 'Bizz Flow Lda',
      company_nif: '123456789',
      company_address: 'Av. 25 de Setembro, Maputo',
      company_phone: '+258 84 123 4567',
      company_email: 'info@bizzflow.co.mz',
      currency: 'MZN',
      tax_rate: '17',
      low_stock_threshold: '10',
      invoice_prefix: 'FAT',
      invoice_start_number: '1001',
      timezone: 'Africa/Maputo',
      enable_stock_alerts: 'true',
      enable_sales_reports: 'true',
      auto_print_invoice: 'true',
      default_payment_method: 'cash',
      default_tax_rate: '17',
      language: 'pt',
      date_format: 'DD/MM/YYYY',
      decimal_separator: ',',
      thousand_separator: '.',
      currency_symbol: 'MT',
      logo_url: '/logo.png',
      theme: 'light',
      backup_frequency: 'daily',
      smtp_host: '',
      smtp_port: '',
      smtp_user: '',
      smtp_password: '',
      email_notifications: 'true'
    };
    
    // Mesclar configurações (padrão + banco de dados)
    const mergedSettings = { ...defaultSettings, ...settings };
    
    res.json({ 
      success: true, 
      settings: mergedSettings,
      last_updated: result.rows.length > 0 ? result.rows[0].updated_at : null
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar configurações.' });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Configurações inválidas.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [key, value] of Object.entries(settings)) {
        // Validar chaves permitidas
        const allowedKeys = [
          'company_name', 'company_nif', 'company_address', 'company_phone', 'company_email',
          'currency', 'tax_rate', 'low_stock_threshold', 'invoice_prefix', 'invoice_start_number',
          'timezone', 'enable_stock_alerts', 'enable_sales_reports', 'auto_print_invoice',
          'default_payment_method', 'default_tax_rate', 'language', 'date_format',
          'decimal_separator', 'thousand_separator', 'currency_symbol', 'logo_url',
          'theme', 'backup_frequency', 'smtp_host', 'smtp_port', 'smtp_user',
          'smtp_password', 'email_notifications'
        ];
        
        if (!allowedKeys.includes(key)) {
          continue; // Pular chaves não permitidas
        }
        
        await client.query(
          `INSERT INTO system_settings (key, value) 
           VALUES ($1, $2)
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
          [key, String(value)]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Configurações atualizadas com sucesso!',
        updated_keys: Object.keys(settings)
      });
      
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

app.get('/api/settings/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Gerar backup dos dados
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '5.0.0',
      data: {}
    };
    
    // Buscar todos os dados
    const tables = ['clients', 'products', 'suppliers', 'sales', 'sale_items', 
                    'team', 'inventory_movements', 'orders', 'order_items', 
                    'users', 'system_settings'];
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        backupData.data[table] = result.rows;
      } catch (error) {
        console.warn(`Não foi possível fazer backup da tabela ${table}:`, error.message);
      }
    }
    
    // Criar arquivo de backup
    const backupDir = 'backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    // Manter apenas últimos 10 backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(path.join(backupDir, files[i]));
      }
    }
    
    res.json({
      success: true,
      message: 'Backup criado com sucesso!',
      backup: {
        filename: filename,
        size: fs.statSync(filepath).size,
        tables: Object.keys(backupData.data).length
      }
    });
    
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar backup.' });
  }
});

app.post('/api/settings/restore', authenticateToken, requireAdmin, upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Arquivo de backup não enviado.' });
    }
    
    // Ler arquivo de backup
    const backupData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    
    if (!backupData.data || typeof backupData.data !== 'object') {
      return res.status(400).json({ success: false, message: 'Arquivo de backup inválido.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Restaurar dados tabela por tabela
      for (const [table, rows] of Object.entries(backupData.data)) {
        if (!Array.isArray(rows)) continue;
        
        // Limpar tabela existente (cuidado!)
        if (table !== 'users') { // Não limpar usuários
          await client.query(`DELETE FROM ${table}`);
        }
        
        // Inserir dados de backup
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Remover arquivo temporário
      fs.unlinkSync(req.file.path);
      
      res.json({
        success: true,
        message: 'Restauração concluída com sucesso!',
        restored: {
          tables: Object.keys(backupData.data).length,
          total_records: Object.values(backupData.data).reduce((sum, rows) => sum + rows.length, 0)
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, message: 'Erro ao restaurar backup.' });
  }
});

// ==============================================
// API - USUÁRIOS (ADMIN)
// ==============================================
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, email, role, created_at, last_login, is_active FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, params.slice(0, paramCount - 1));
    
    res.json({
      success: true,
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar usuários.' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }
    
    // Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email já está em uso.' });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role, created_at, is_active`,
      [name, email.toLowerCase().trim(), hashedPassword, role]
    );
    
    res.status(201).json({
      success: true,
      user: result.rows[0],
      message: 'Usuário criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar usuário.' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;
    
    // Verificar se usuário existe
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    
    if (userExists.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    
    // Verificar se novo email já existe
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email já está em uso por outro usuário.' });
      }
    }
    
    const result = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, role = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, role, created_at, last_login, is_active`,
      [name, email, role, is_active !== false, id]
    );
    
    res.json({
      success: true,
      user: result.rows[0],
      message: 'Usuário atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar usuário.' });
  }
});

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================
function getUserPermissions(role) {
  const permissions = {
    admin: {
      dashboard: ['read', 'write'],
      clients: ['read', 'write', 'delete'],
      products: ['read', 'write', 'delete'],
      sales: ['read', 'write', 'delete', 'cancel'],
      inventory: ['read', 'write', 'delete'],
      suppliers: ['read', 'write', 'delete'],
      team: ['read', 'write', 'delete'],
      orders: ['read', 'write', 'delete', 'status'],
      reports: ['read', 'export'],
      settings: ['read', 'write'],
      users: ['read', 'write', 'delete']
    },
    manager: {
      dashboard: ['read', 'write'],
      clients: ['read', 'write'],
      products: ['read', 'write'],
      sales: ['read', 'write', 'cancel'],
      inventory: ['read', 'write'],
      suppliers: ['read', 'write'],
      team: ['read'],
      orders: ['read', 'write', 'status'],
      reports: ['read', 'export'],
      settings: ['read'],
      users: ['read']
    },
    user: {
      dashboard: ['read'],
      clients: ['read', 'write'],
      products: ['read'],
      sales: ['read', 'write'],
      inventory: ['read'],
      suppliers: ['read'],
      team: ['read'],
      orders: ['read'],
      reports: ['read'],
      settings: ['read'],
      users: []
    }
  };
  
  return permissions[role] || permissions.user;
}

// ==============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ==============================================
async function initializeDatabase() {
  console.log('🔄 Inicializando banco de dados...');
  
  try {
    // Criar tabelas básicas (mesmo do frontend)
    await pool.query(`
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
      
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
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
      
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        type VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        reason VARCHAR(100),
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
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
      
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
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
      'auto_print_invoice': 'true',
      'default_payment_method': 'cash',
      'default_tax_rate': '17',
      'language': 'pt',
      'date_format': 'DD/MM/YYYY'
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
    
    // Criar dados de exemplo
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
        INSERT INTO clients (name, email, phone, address, city, category, nif) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'Av. da Liberdade 123', 'Maputo', 'VIP', '100000001'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'Rua do Comércio 456', 'Matola', 'normal', '100000002'),
        ('Empresa XYZ Ltda', 'contato@xyz.com', '+258843456789', 'Zona Industrial', 'Beira', 'corporate', '100500003'),
        ('Carlos Mendes', 'carlos@email.com', '+258844567890', 'Bairro Central 789', 'Nampula', 'wholesale', '100000004'),
        ('Ana Pereira', 'ana@email.com', '+258845678901', 'Centro Urbano 101', 'Quelimane', 'normal', '100000005'),
        ('Pedro Costa', 'pedro@email.com', '+258846789012', 'Av. Marginal 202', 'Maputo', 'VIP', '100000006'),
        ('Sofia Almeida', 'sofia@email.com', '+258847890123', 'Rua das Flores 303', 'Matola', 'normal', '100000007'),
        ('Restaurante Bom Sabor', 'bomsabor@email.com', '+258848901234', 'Praça Central 404', 'Beira', 'corporate', '100500008'),
        ('Loja Popular', 'lojapopular@email.com', '+258849012345', 'Mercado Municipal 505', 'Nampula', 'wholesale', '100500009'),
        ('Hotel Estrela', 'hotel@email.com', '+258840123456', 'Av. Beira Mar 606', 'Quelimane', 'corporate', '100500010')
      `);
    }
    
    if (parseInt(productsCount.rows[0].count) === 0) {
      console.log('📦 Criando produtos de exemplo...');
      await pool.query(`
        INSERT INTO products (code, name, description, category, unit_price, cost_price, stock, min_stock, barcode, supplier) VALUES
        ('PROD001', 'Arroz 5kg', 'Arroz branco de grão longo', 'Alimentos', 350.00, 280.00, 100, 20, '789100001', 'Fornecedor A'),
        ('PROD002', 'Feijão 1kg', 'Feijão preto selecionado', 'Alimentos', 120.00, 90.00, 50, 15, '789100002', 'Fornecedor A'),
        ('PROD003', 'Óleo 1L', 'Óleo vegetal de soja', 'Alimentos', 150.00, 110.00, 75, 10, '789100003', 'Fornecedor B'),
        ('PROD004', 'Açúcar 1kg', 'Açúcar cristal refinado', 'Alimentos', 80.00, 60.00, 120, 30, '789100004', 'Fornecedor A'),
        ('PROD005', 'Sabão em Pó 1kg', 'Sabão em pó para roupa', 'Limpeza', 85.00, 60.00, 45, 10, '789100005', 'Fornecedor C'),
        ('PROD006', 'Detergente 500ml', 'Detergente líquido neutro', 'Limpeza', 65.00, 45.00, 80, 20, '789100006', 'Fornecedor C'),
        ('PROD007', 'Água 1.5L', 'Água mineral sem gás', 'Bebidas', 25.00, 15.00, 200, 50, '789100007', 'Fornecedor D'),
        ('PROD008', 'Refrigerante 2L', 'Refrigerante de cola', 'Bebidas', 95.00, 70.00, 60, 15, '789100008', 'Fornecedor D'),
        ('PROD009', 'Cerveja 330ml', 'Cerveja lata 330ml', 'Bebidas', 45.00, 30.00, 150, 30, '789100009', 'Fornecedor D'),
        ('PROD010', 'Leite 1L', 'Leite UHT integral', 'Laticínios', 55.00, 40.00, 90, 20, '789100010', 'Fornecedor E'),
        ('PROD011', 'Café 500g', 'Café torrado e moído', 'Alimentos', 180.00, 130.00, 40, 10, '789100011', 'Fornecedor A'),
        ('PROD012', 'Massas 500g', 'Massa espaguete', 'Alimentos', 65.00, 45.00, 85, 25, '789100012', 'Fornecedor A'),
        ('PROD013', 'Atum em Lata', 'Atum em óleo 170g', 'Enlatados', 95.00, 70.00, 60, 15, '789100013', 'Fornecedor B'),
        ('PROD014', 'Molho Tomate', 'Molho de tomate 340g', 'Enlatados', 45.00, 30.00, 110, 30, '789100014', 'Fornecedor B'),
        ('PROD015', 'Desinfetante 1L', 'Desinfetante pinho', 'Limpeza', 75.00, 50.00, 55, 15, '789100015', 'Fornecedor C'),
        ('PROD016', 'Papel Higiênico', 'Rolo 30m 4 unidades', 'Higiene', 125.00, 85.00, 70, 20, '789100016', 'Fornecedor C'),
        ('PROD017', 'Sabonete', 'Sabonete líquido 250ml', 'Higiene', 35.00, 25.00, 95, 25, '789100017', 'Fornecedor C'),
        ('PROD018', 'Chá 100g', 'Chá preto em sachês', 'Bebidas', 55.00, 35.00, 65, 15, '789100018', 'Fornecedor A'),
        ('PROD019', 'Bolachas 400g', 'Bolachas cream cracker', 'Alimentos', 85.00, 60.00, 45, 12, '789100019', 'Fornecedor B'),
        ('PROD020', 'Sal 1kg', 'Sal refinado iodado', 'Alimentos', 40.00, 25.00, 130, 40, '789100020', 'Fornecedor A')
      `);
    }
    
    // Verificar fornecedores
    const suppliersCount = await pool.query('SELECT COUNT(*) as count FROM suppliers');
    if (parseInt(suppliersCount.rows[0].count) === 0) {
      console.log('🚚 Criando fornecedores de exemplo...');
      await pool.query(`
        INSERT INTO suppliers (name, contact, email, address, products, rating) VALUES
        ('Fornecedor A', '+258841111111', 'fornecedorA@email.com', 'Maputo, Zona Industrial', '{"Arroz", "Feijão", "Açúcar", "Café", "Massas", "Sal"}', 4.5),
        ('Fornecedor B', '+258842222222', 'fornecedorB@email.com', 'Matola, Av. das Indústrias', '{"Óleo", "Margarina", "Atum", "Molho Tomate", "Bolachas"}', 4.2),
        ('Fornecedor C', '+258843333333', 'fornecedorC@email.com', 'Beira, Zona Franca', '{"Sabão", "Detergente", "Desinfetante", "Papel Higiênico", "Sabonete"}', 4.0),
        ('Fornecedor D', '+258844444444', 'fornecedorD@email.com', 'Nampula, Centro Comercial', '{"Bebidas", "Água", "Refrigerante", "Cerveja"}', 4.7),
        ('Fornecedor E', '+258845555555', 'fornecedorE@email.com', 'Quelimane, Mercado Grossista', '{"Leite", "Queijo", "Iogurte", "Manteiga"}', 4.3)
      `);
    }
    
    // Verificar equipa
    const teamCount = await pool.query('SELECT COUNT(*) as count FROM team');
    if (parseInt(teamCount.rows[0].count) === 0) {
      console.log('👥 Criando equipa de exemplo...');
      await pool.query(`
        INSERT INTO team (name, role, contact, email, join_date, salary) VALUES
        ('Carlos Vendedor', 'Vendedor', '+258846666666', 'carlos@bizzflow.co.mz', '2024-01-10', 15000.00),
        ('Ana Gestora', 'Gestora', '+258847777777', 'ana@bizzflow.co.mz', '2024-01-15', 25000.00),
        ('Pedro Estoquista', 'Estoquista', '+258848888888', 'pedro@bizzflow.co.mz', '2024-01-20', 12000.00),
        ('Sofia Atendente', 'Atendente', '+258849999999', 'sofia@bizzflow.co.mz', '2024-01-25', 11000.00),
        ('Miguel Supervisor', 'Supervisor', '+258840000000', 'miguel@bizzflow.co.mz', '2024-02-01', 18000.00)
      `);
    }
    
    console.log('✅ Dados de exemplo criados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de exemplo:', error.message);
  }
}

// ==============================================
// CONFIGURAÇÃO DE KEEP-ALIVE AUTOMÁTICO
// ==============================================
const startKeepAlive = () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('🔋 Ativando keep-alive automático (5 minutos)...');
    setInterval(async () => {
      try {
        const response = await fetch(`https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'bizzflow-crm.onrender.com'}/health`);
        const data = await response.json();
        console.log(`✅ Keep-alive: ${new Date().toLocaleTimeString()} - Status: ${data.status}`);
      } catch (err) {
        console.log(`⚠️ Keep-alive falhou: ${err.message}`);
      }
    }, 5 * 60 * 1000);
  }
};

// ==============================================
// TRATAMENTO DE ERROS 404
// ==============================================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Rota API não encontrada: ${req.method} ${req.path}`
    });
  }
  
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - BizzFlow CRM</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        p { color: #666; }
        a { color: #007bff; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Página Não Encontrada</h1>
      <p>A página que você está procurando não existe.</p>
      <p><a href="/">Voltar para o Dashboard</a></p>
    </body>
    </html>
  `);
});

// ==============================================
// TRATAMENTO DE ERROS GERAIS
// ==============================================
app.use((error, req, res, next) => {
  console.error('💥 ERRO INTERNO:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } else {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>500 - Erro do Servidor</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #dc3545; }
          p { color: #666; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>500 - Erro do Servidor</h1>
        <p>Ocorreu um erro interno no servidor.</p>
        <p><a href="/">Voltar para o Dashboard</a></p>
        ${process.env.NODE_ENV === 'development' ? `<pre>${error.message}</pre>` : ''}
      </body>
      </html>
    `);
  }
});

// ==============================================
// INICIALIZAÇÃO DO SERVIDOR
// ==============================================
const startServer = async () => {
  try {
    console.log('='.repeat(70));
    console.log('🚀 INICIANDO BIZZFLOW CRM BACKEND v5.0');
    console.log('='.repeat(70));
    console.log(`🕐 ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: ${process.env.DATABASE_URL ? '✓ Configurada' : '✗ Não configurada'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ Configurada' : '✗ Usando padrão'}`);
    console.log(`🚪 Porta: ${PORT}`);
    console.log('='.repeat(70));
    
    // Inicializar banco de dados
    await initializeDatabase();
    
    // Verificar conexão com banco
    console.log('🔍 Verificando conexão com banco de dados...');
    try {
      const dbClient = await pool.connect();
      console.log('✅ Conectado ao PostgreSQL com sucesso!');
      console.log(`📊 Banco: ${dbClient.database}`);
      console.log(`👤 Usuário: ${dbClient.user}`);
      dbClient.release();
    } catch (dbError) {
      console.error('❌ Erro ao conectar ao banco de dados:', dbError.message);
      console.log('🔄 Tentando reconexão em 10 segundos...');
      setTimeout(() => {
        console.log('❌ Falha na conexão. Saindo...');
        process.exit(1);
      }, 10000);
      return;
    }
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM v5.0 - ONLINE                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ✅ STATUS:         SERVIDOR ATIVO                                          ║
║ 📍 PORTA:          ${PORT.toString().padEnd(48)} ║
║ 🌍 AMBIENTE:       ${(process.env.NODE_ENV || 'development').padEnd(47)} ║
║ 🔗 URL LOCAL:      http://localhost:${PORT.toString().padEnd(43)} ║
║ 👤 LOGIN:          admin@bizzflow.com / admin123                          ║
║                                                                              ║
║ 📡 ENDPOINTS PRINCIPAIS:                                                   ║
║   • POST   /api/auth/login                                                 ║
║   • GET    /api/dashboard/stats                                            ║
║   • GET    /api/clients                                                    ║
║   • POST   /api/clients                                                    ║
║   • GET    /api/products                                                   ║
║   • POST   /api/products                                                   ║
║   • GET    /api/sales                                                      ║
║   • POST   /api/sales                                                      ║
║   • GET    /api/inventory                                                  ║
║   • GET    /api/reports/sales                                              ║
║   • GET    /api/orders                                                     ║
║   • POST   /api/orders                                                     ║
║   • GET    /api/settings                                                   ║
║   • POST   /api/settings                                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
      `);
      
      // Iniciar keep-alive
      startKeepAlive();
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('🛑 Recebido sinal de desligamento...');
      
      server.close(() => {
        console.log('👋 Servidor HTTP fechado');
        pool.end(() => {
          console.log('🗄️ Conexão com banco de dados fechada');
          process.exit(0);
        });
      });

      setTimeout(() => {
        console.error('⏰ Timeout forçando desligamento...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // Tratar erros do servidor
    server.on('error', (error) => {
      console.error('💥 Erro no servidor:', error);
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Porta ${PORT} já em uso.`);
        process.exit(1);
      }
    });
    
    console.log('✅ Servidor iniciado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// ==============================================
// TRATAMENTO DE ERROS GLOBAIS
// ==============================================
process.on('uncaughtException', (err) => {
  console.error('💥 ERRO NÃO CAPTURADO:', {
    message: err.message,
    timestamp: new Date().toISOString(),
    stack: err.stack
  });
  
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Continuando execução...');
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ PROMISE REJEITADA NÃO TRATADA:', {
    reason: reason?.message || reason,
    timestamp: new Date().toISOString()
  });
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
startServer();
