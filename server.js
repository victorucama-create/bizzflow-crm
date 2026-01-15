// ==============================================
// BIZZFLOW CRM v5.0 - SERVIDOR UNIFICADO COMPLETO
// Backend API + Frontend SPA em um único servidor
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
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  }
});

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://bizzflow-crm.onrender.com", "http://localhost:10000"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      childSrc: ["'self'"]
    }
  },
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

// Middleware para logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ==============================================
// SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND
// ==============================================
app.use(express.static('public', {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

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
      version: '5.0.0',
      environment: process.env.NODE_ENV || 'development'
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

// ==============================================
// API - DASHBOARD
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
      `SELECT COALESCE(SUM(final_amount), 0) as total FROM sales 
       WHERE DATE(sale_date) >= $1 AND status = 'completed'`,
      [firstDayOfMonth]
    );
    
    // Total de produtos
    const productsResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true'
    );
    
    // Vendas dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    
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
    
    res.json({
      success: true,
      stats: {
        sales_today: {
          count: parseInt(salesTodayResult.rows[0].count),
          total: parseFloat(salesTodayResult.rows[0].total)
        },
        total_clients: parseInt(clientsResult.rows[0].count),
        low_stock_products: parseInt(lowStockResult.rows[0].count),
        monthly_revenue: parseFloat(monthlySalesResult.rows[0].total),
        total_products: parseInt(productsResult.rows[0].count),
        last_7_days: last7DaysSalesResult.rows,
        top_products: topProductsResult.rows
      }
    });
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar estatísticas do dashboard.' });
  }
});

// ==============================================
// API - CLIENTES
// ==============================================
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM clients WHERE is_active = true';
    let countQuery = 'SELECT COUNT(*) FROM clients WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
       (SELECT COUNT(*) FROM sales WHERE client_id = c.id) as total_sales,
       (SELECT SUM(final_amount) FROM sales WHERE client_id = c.id) as total_spent
       FROM clients c WHERE id = $1 AND is_active = true`,
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
      [name, email || null, phone || null, address || null, city || null, 
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
    
    const result = await pool.query(
      'UPDATE clients SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }
    
    res.json({ success: true, message: 'Cliente desativado com sucesso!' });
    
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, message: 'Erro ao desativar cliente.' });
  }
});

// Importação de clientes via CSV
app.post('/api/clients/import', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
  }
  
  try {
    const clients = [];
    const errors = [];
    let imported = 0;
    
    // Ler arquivo CSV
    const filePath = req.file.path;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        clients.push(row);
      })
      .on('end', async () => {
        for (const client of clients) {
          try {
            if (!client.name) {
              errors.push({ client, error: 'Nome é obrigatório' });
              continue;
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
          }
        }
        
        // Remover arquivo
        fs.unlinkSync(filePath);
        
        res.json({
          success: true,
          message: 'Importação concluída',
          summary: {
            imported,
            failed: errors.length,
            total: clients.length,
            errors: errors.slice(0, 10)
          }
        });
      })
      .on('error', (error) => {
        fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: 'Erro ao ler arquivo CSV.' });
      });
    
  } catch (error) {
    console.error('Import clients error:', error);
    res.status(500).json({ success: false, message: 'Erro ao importar clientes.' });
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
    let countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = true';
    let params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (low_stock === 'true') {
      query += ` AND stock <= min_stock`;
      countQuery += ` AND stock <= min_stock`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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

// Atualização de stock
app.patch('/api/products/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation = 'set', reason = 'Ajuste manual' } = req.body;
    
    if (!quantity && quantity !== 0) {
      return res.status(400).json({ success: false, message: 'Quantidade é obrigatória.' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Buscar produto atual
      const productResult = await client.query(
        'SELECT id, name, stock FROM products WHERE id = $1',
        [id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
      }
      
      const product = productResult.rows[0];
      let newStock;
      let movementType;
      
      switch (operation) {
        case 'add':
          newStock = product.stock + parseInt(quantity);
          movementType = 'entrada';
          break;
        case 'subtract':
          newStock = product.stock - parseInt(quantity);
          if (newStock < 0) {
            throw new Error('Stock não pode ser negativo');
          }
          movementType = 'saida';
          break;
        case 'set':
          newStock = parseInt(quantity);
          movementType = 'ajuste';
          break;
        default:
          throw new Error('Operação inválida');
      }
      
      // Atualizar stock
      const updateResult = await client.query(
        'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [newStock, id]
      );
      
      // Registrar movimentação
      await client.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, reason, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, movementType, Math.abs(parseInt(quantity)), reason, req.userId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        product: updateResult.rows[0],
        movement: {
          type: movementType,
          quantity: Math.abs(parseInt(quantity)),
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
    res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar stock.' });
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
    
    // Verificar stock e calcular totais
    let subtotal = 0;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT stock, name FROM products WHERE id = $1',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        throw new Error(`Produto ${item.product_id} não encontrado`);
      }
      
      if (productResult.rows[0].stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${productResult.rows[0].name}. Disponível: ${productResult.rows[0].stock}`);
      }
      
      subtotal += item.unit_price * item.quantity;
    }
    
    const final_amount = subtotal - discount + tax;
    
    if (amount_received && amount_received < final_amount) {
      return res.status(400).json({ success: false, message: 'Valor recebido é menor que o total.' });
    }
    
    // Gerar número da venda
    const date = new Date();
    const sale_number = `V${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(Date.now()).slice(-4)}`;
    
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
    
    // Buscar venda completa
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

// ==============================================
// API - INVENTÁRIO
// ==============================================
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { low_stock = false, category } = req.query;
    
    let query = `
      SELECT 
        p.*,
        (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id) as total_sold
      FROM products p
      WHERE p.is_active = true
    `;
    
    if (low_stock === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    if (category) {
      query += ` AND p.category = $1`;
    }
    
    query += ` ORDER BY p.stock ASC`;
    
    const result = await category ? 
      await pool.query(query, [category]) : 
      await pool.query(query);
    
    // Calcular valor total do inventário
    let totalValue = 0;
    for (const product of result.rows) {
      totalValue += (product.cost_price || product.unit_price * 0.7) * product.stock;
    }
    
    res.json({
      success: true,
      inventory: result.rows,
      summary: {
        total_products: result.rows.length,
        low_stock_count: result.rows.filter(p => p.stock <= p.min_stock).length,
        total_value: totalValue.toFixed(2)
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

// ==============================================
// API - RELATÓRIOS
// ==============================================
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    
    let dateFormat, groupClause;
    
    switch (group_by) {
      case 'month':
        dateFormat = "TO_CHAR(sale_date, 'YYYY-MM')";
        groupClause = "TO_CHAR(sale_date, 'YYYY-MM')";
        break;
      case 'year':
        dateFormat = "TO_CHAR(sale_date, 'YYYY')";
        groupClause = "TO_CHAR(sale_date, 'YYYY')";
        break;
      case 'day':
      default:
        dateFormat = 'DATE(sale_date)';
        groupClause = 'DATE(sale_date)';
        break;
    }
    
    let query = `
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_value
      FROM sales
      WHERE status = 'completed'
    `;
    
    let params = [];
    
    if (start_date) {
      query += ` AND DATE(sale_date) >= $1`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND DATE(sale_date) <= $${params.length + 1}`;
      params.push(end_date);
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
        MAX(final_amount) as max_sale
      FROM sales
      WHERE status = 'completed'
      ${start_date ? ` AND DATE(sale_date) >= $1` : ''}
      ${end_date ? ` AND DATE(sale_date) <= $${start_date ? 2 : 1}` : ''}
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
      WHERE s.status = 'completed'
      ${start_date ? ` AND DATE(s.sale_date) >= $1` : ''}
      ${end_date ? ` AND DATE(s.sale_date) <= $${start_date ? 2 : 1}` : ''}
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

// ==============================================
// API - FORNECEDORES
// ==============================================
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE is_active = true ORDER BY created_at DESC');
    
    res.json({
      success: true,
      suppliers: result.rows
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
    const result = await pool.query('SELECT * FROM team WHERE is_active = true ORDER BY created_at DESC');
    
    res.json({
      success: true,
      team: result.rows
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
// API - ENCOMENDAS
// ==============================================
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT o.*, c.name as client_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE 1=1
    `;
    
    let params = [];
    
    if (status) {
      query += ` AND o.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY o.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      orders: result.rows
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
    
    // Calcular total
    let total = 0;
    for (const item of items) {
      const productResult = await pool.query(
        'SELECT unit_price FROM products WHERE id = $1',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: `Produto ${item.product_id} não encontrado` });
      }
      
      const unitPrice = productResult.rows[0].unit_price;
      total += unitPrice * item.quantity;
    }
    
    // Gerar número da encomenda
    const date = new Date();
    const order_number = `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(Date.now()).slice(-4)}`;
    
    // Criar encomenda
    const orderResult = await pool.query(
      `INSERT INTO orders (order_number, client_id, total_amount, delivery_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [order_number, client_id || null, total, delivery_date || null, notes || null]
    );
    
    res.status(201).json({
      success: true,
      order: orderResult.rows[0],
      message: 'Encomenda criada com sucesso!'
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar encomenda.' });
  }
});

// ==============================================
// API - CONFIGURAÇÕES
// ==============================================
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
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
      auto_print_invoice: 'true'
    };
    
    // Tentar buscar do banco primeiro
    try {
      const result = await pool.query('SELECT * FROM system_settings');
      const dbSettings = {};
      result.rows.forEach(row => {
        dbSettings[row.key] = row.value;
      });
      
      // Combinar (banco tem prioridade)
      const settings = { ...defaultSettings, ...dbSettings };
      res.json({ success: true, settings: settings });
    } catch (error) {
      // Se tabela não existir, retornar padrão
      res.json({ success: true, settings: defaultSettings });
    }
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar configurações.' });
  }
});

// ==============================================
// API - USUÁRIOS (ADMIN)
// ==============================================
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at, last_login, is_active FROM users ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      users: result.rows
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar usuários.' });
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
    // Criar tabelas básicas
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
        INSERT INTO clients (name, email, phone, address, category, nif) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'Maputo', 'VIP', '100000001'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'Matola', 'normal', '100000002'),
        ('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'Beira', 'corporate', '100500003'),
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
    
    console.log('✅ Dados de exemplo criados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar dados de exemplo:', error.message);
  }
}

// ==============================================
// ROTAS DO FRONTEND (SPA)
// ==============================================
// Servir o frontend SPA
app.get(['/', '/dashboard', '/clients', '/products', '/sales', '/inventory', '/reports', 
         '/suppliers', '/team', '/orders', '/settings', '/profile', '/login', '/register'], 
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

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
// INICIALIZAÇÃO DO SERVIDOR
// ==============================================
const startServer = async () => {
  try {
    console.log('='.repeat(70));
    console.log('🚀 INICIANDO BIZZFLOW CRM v5.0 (UNIFICADO)');
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
    
    // Criar diretório public se não existir
    const fs = require('fs');
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      console.log('📁 Diretório public criado');
    }
    
    // Criar arquivo index.html básico se não existir
    const indexPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      const htmlContent = `
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BizzFlow CRM</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 50px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p {
            font-size: 18px;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 30px 0;
        }
        .feature {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #a5b4fc;
        }
        .feature h3 {
            font-size: 14px;
            margin-bottom: 5px;
            color: #e2e8f0;
        }
        .feature p {
            font-size: 12px;
            opacity: 0.8;
            margin: 0;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.3s, box-shadow 0.3s;
            margin-top: 20px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .loading {
            margin: 20px 0;
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BizzFlow CRM</h1>
        <p>Sistema de Gestão Comercial Completo</p>
        
        <div class="features">
            <div class="feature">
                <h3>📊 Dashboard</h3>
                <p>Estatísticas em tempo real</p>
            </div>
            <div class="feature">
                <h3>👥 Clientes</h3>
                <p>Gestão completa</p>
            </div>
            <div class="feature">
                <h3>📦 Produtos</h3>
                <p>Controle de inventário</p>
            </div>
            <div class="feature">
                <h3>💰 Vendas</h3>
                <p>Registro e faturação</p>
            </div>
        </div>
        
        <div class="loading">Carregando aplicação...</div>
        
        <a href="/dashboard" class="btn">Acessar Dashboard</a>
        
        <div style="margin-top: 30px; font-size: 12px; opacity: 0.6;">
            <p>Backend API: <a href="/api/test" style="color: #a5b4fc;">Testar API</a></p>
            <p>Health Check: <a href="/health" style="color: #a5b4fc;">Verificar Status</a></p>
        </div>
    </div>
    
    <script>
        // Detectar se está carregado
        setTimeout(() => {
            document.querySelector('.loading').textContent = 'Aplicação pronta!';
        }, 2000);
    </script>
</body>
</html>`;
      fs.writeFileSync(indexPath, htmlContent);
      console.log('📄 Arquivo index.html criado');
    }
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM v5.0 - ONLINE (UNIFICADO)                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ✅ STATUS:         SERVIDOR ATIVO                                          ║
║ 📍 PORTA:          ${PORT.toString().padEnd(48)} ║
║ 🌍 AMBIENTE:       ${(process.env.NODE_ENV || 'development').padEnd(47)} ║
║ 🔗 URL:            http://localhost:${PORT.toString().padEnd(43)} ║
║ 👤 LOGIN:          admin@bizzflow.com / admin123                          ║
║                                                                              ║
║ 📡 ENDPOINTS PRINCIPAIS:                                                   ║
║   • GET  /                    Frontend SPA                                 ║
║   • POST /api/auth/login      Autenticação                                 ║
║   • GET  /api/dashboard/stats Dashboard                                    ║
║   • GET  /api/clients         Clientes                                     ║
║   • GET  /api/products        Produtos                                     ║
║   • GET  /api/sales           Vendas                                       ║
║   • GET  /api/health          Health check                                 ║
║                                                                              ║
║ 🔧 SISTEMA:                                                                 ║
║   • Backend: API Node.js + PostgreSQL                                      ║
║   • Frontend: SPA React/HTML5                                              ║
║   • Autenticação: JWT                                                      ║
║   • Uploads: CSV import                                                    ║
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
// INICIAR SERVIDOR
// ==============================================
startServer();
