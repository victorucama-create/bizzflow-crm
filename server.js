// ==============================================
// BIZZFLOW CRM v3.2 - SERVER COMPLETO CORRIGIDO
// ==============================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
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
  connectionTimeoutMillis: 2000,
});

// ==============================================
// MIDDLEWARE SEGURO E FUNCIONAL
// ==============================================

// Configurar Helmet com CSP CORRIGIDO
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "https://www.googletagmanager.com",
        "https://browser.sentry-cdn.com",
        "https://cdn.jsdelivr.net",
        "https://www.google-analytics.com",
        "https://ssl.google-analytics.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: [
        "'self'", 
        "data:",
        "https://fonts.gstatic.com", 
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      connectSrc: [
        "'self'",
        "https://bizzflow-crm.onrender.com",
        "http://localhost:*",
        "ws://localhost:*",
        "https://www.google-analytics.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false
}));

// Configurar CORS CORRIGIDO
app.use(cors({
  origin: function(origin, callback) {
    // Permitir todas as origens durante desenvolvimento/testes
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, permitir domínios específicos
    const allowedOrigins = [
      'https://bizzflow-crm.onrender.com',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:10000',
      'https://bizzflow-crm-frontend.onrender.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para logging
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Headers de segurança customizados
app.use((req, res, next) => {
  res.header('X-Powered-By', 'BizzFlow CRM');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).json({});
  }
  
  next();
});

// ==============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==============================================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : req.query.token || req.body.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido.'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bizzflow-secret-key-2024');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    req.userName = decoded.name;
    
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado. Faça login novamente.'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token inválido.'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Requer permissões de administrador.'
    });
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
      status: 'ok',
      service: 'BizzFlow CRM API',
      version: '3.2.0',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
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

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'BizzFlow CRM',
    version: '3.2.0',
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API está funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint
app.get('/keep-alive', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==============================================
// API - AUTENTICAÇÃO
// ==============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios.'
      });
    }

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
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      process.env.JWT_SECRET || 'bizzflow-secret-key-2024',
      { expiresIn: '30d' }
    );

    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

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
// API - CLIENTES
// ==============================================
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { search = '', category = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
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
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Contagem total
    let countQuery = 'SELECT COUNT(*) FROM clients WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ` AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`;
      countParams.push(`%${search}%`);
    }
    
    if (category) {
      countQuery += ` AND category = $${countParams.length + 1}`;
      countParams.push(category);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      clients: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes.'
    });
  }
});

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
    
    if (error.code === '23505') {
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

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, province, category } = req.body;
    
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
    
    if (error.code === '23505') {
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

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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

// ==============================================
// API - PRODUTOS
// ==============================================
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { search = '', category = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
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
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rowCount
      }
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos.'
    });
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
    
    if (error.code === '23505') {
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

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, unit_price, cost_price, stock, min_stock, supplier } = req.body;
    
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

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    const inSales = await pool.query(
      'SELECT COUNT(*) FROM sale_items WHERE product_id = $1',
      [id]
    );
    
    if (parseInt(inSales.rows[0].count) > 0) {
      await pool.query(
        'UPDATE products SET is_active = false WHERE id = $1',
        [id]
      );
      
      return res.json({
        success: true,
        message: 'Produto desativado (está em vendas históricas).'
      });
    }
    
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

// ==============================================
// API - VENDAS
// ==============================================
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date = '', end_date = '', client_id = '', limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT s.*, c.name as client_name 
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
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
    
    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      sales: result.rows,
      total: result.rowCount,
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

app.get('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
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

app.post('/api/sales', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
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
      
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale.id, item.product_id, item.quantity, unitPrice, unitPrice * item.quantity]
      );
      
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
    if (client_id) {
      await client.query(
        `UPDATE clients 
         SET total_spent = total_spent + $1, last_purchase = CURRENT_DATE
         WHERE id = $2`,
        [final_amount, client_id]
      );
    }
    
    await client.query('COMMIT');
    
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
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar venda.'
    });
  } finally {
    client.release();
  }
});

app.delete('/api/sales/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
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
    
    await client.query('BEGIN');
    
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
      [id]
    );
    
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
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
    
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await client.query('DELETE FROM sales WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Venda excluída com sucesso!'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir venda.'
    });
  } finally {
    client.release();
  }
});

// ==============================================
// API - DASHBOARD
// ==============================================
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const [
      salesToday, 
      revenueToday, 
      totalClients, 
      totalProducts, 
      lowStock
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM clients"),
      pool.query("SELECT COUNT(*) FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM products WHERE stock <= min_stock AND is_active = true")
    ]);
    
    res.json({
      success: true,
      metrics: {
        sales_today: parseInt(salesToday.rows[0].count),
        revenue_today: parseFloat(revenueToday.rows[0].coalesce),
        total_clients: parseInt(totalClients.rows[0].count),
        total_products: parseInt(totalProducts.rows[0].count),
        low_stock_items: parseInt(lowStock.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas.'
    });
  }
});

// ==============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ==============================================
async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');
    
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
    
    // Criar admin padrão
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
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   BIZZFLOW CRM v3.2                           ║
╠════════════════════════════════════════════════════════════════╣
║ Status:        ✅ ONLINE                                      ║
║ Ambiente:      ${process.env.NODE_ENV || 'development'.padEnd(40)} ║
║ Porta:         ${PORT.toString().padEnd(43)} ║
║ URL:           http://localhost:${PORT.toString().padEnd(39)} ║
║ Produção:      https://bizzflow-crm.onrender.com              ║
║                                                                ║
║ 🔧 ENDPOINTS:                                                 ║
║   • /health             → Health check                        ║
║   • /api/auth/login     → Login                               ║
║   • /api/clients/*      → CRUD de clientes                    ║
║   • /api/products/*     → CRUD de produtos                    ║
║   • /api/sales/*        → CRUD de vendas                      ║
║   • /api/dashboard/*    → Dashboard                           ║
║                                                                ║
║ ⚡ CORREÇÕES APLICADAS:                                       ║
║   • CSP Corrigido          • CORS Funcional                   ║
║   • Helmet Configurado     • Keep-alive Ativo                 ║
║   • Erros Tratados         • Performance Otimizada            ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
