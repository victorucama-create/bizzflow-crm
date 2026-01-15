// ==============================================
// BIZZFLOW CRM v3.1 - SERVER COMPLETO CORRIGIDO
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

// Testar conexão com banco
pool.on('connect', () => {
  console.log('🗄️  Nova conexão com PostgreSQL estabelecida');
});

pool.on('error', (err) => {
  console.error('💥 Erro inesperado na conexão PostgreSQL:', err);
});

// ==============================================
// MIDDLEWARE SEGURO E FUNCIONAL
// ==============================================

// Configurar Helmet com CSP que não bloqueia a aplicação
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
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com"
      ],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com", 
        "https://cdn.jsdelivr.net",
        "data:"
      ],
      connectSrc: [
        "'self'", 
        "https://bizzflow-crm.onrender.com",
        "http://localhost:*",
        "ws://localhost:*"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false
}));

// Configurar CORS para funcionar com frontend
app.use(cors({
  origin: function(origin, callback) {
    // Em desenvolvimento, permitir todas as origens
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Em produção, permitir domínios específicos
    const allowedOrigins = [
      'https://bizzflow-crm.onrender.com',
      'http://bizzflow-crm.onrender.com',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:10000'
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
      : req.query.token;
    
    if (!token) {
      console.log('⚠️  Token não fornecido');
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

// Middleware para verificar admin
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

// Health Check aprimorado
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    
    // Informações do sistema
    const systemInfo = {
      status: 'healthy',
      service: 'BizzFlow CRM API',
      version: '3.1.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/auth/*',
        clients: '/api/clients/*',
        products: '/api/products/*',
        sales: '/api/sales/*',
        dashboard: '/api/dashboard/*',
        reports: '/api/reports/*'
      }
    };
    
    res.json(systemInfo);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
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
    version: '3.1.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleString(),
    apiStatus: 'operational',
    features: ['authentication', 'clients', 'products', 'sales', 'reports', 'dashboard']
  });
});

// Test endpoint para frontend
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API está funcionando!',
    timestamp: new Date().toISOString(),
    frontendReady: true
  });
});

// ==============================================
// API - AUTENTICAÇÃO (MELHORADO)
// ==============================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`🔐 Tentativa de login: ${email}`);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios.'
      });
    }

    // Buscar usuário
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }
    
    const user = result.rows[0];
    
    // Verificar senha
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      console.log(`❌ Senha incorreta para: ${email}`);
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
      process.env.JWT_SECRET || 'bizzflow-secret-key-2024',
      { expiresIn: '30d' } // Token válido por 30 dias
    );

    // Atualizar último login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Remover senha da resposta
    const { password: _, ...userWithoutPassword } = user;
    
    console.log(`✅ Login bem-sucedido: ${email}`);
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      message: 'Login realizado com sucesso!',
      redirectTo: '/dashboard.html'
    });
    
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao realizar login. Tente novamente.'
    });
  }
});

// Validar token
app.post('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      valid: true,
      user: {
        id: req.userId,
        email: req.userEmail,
        role: req.userRole,
        name: req.userName
      },
      message: 'Token válido'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      message: 'Token inválido'
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

// Criar usuário (admin apenas)
app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios.'
      });
    }
    
    // Verificar se email já existe
    const emailExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (emailExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está registrado.'
      });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashedPassword, role]
    );
    
    res.status(201).json({
      success: true,
      user: result.rows[0],
      message: 'Usuário criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário.'
    });
  }
});

// ==============================================
// API - CLIENTES (CRUD COMPLETO E OTIMIZADO)
// ==============================================

// Listar clientes com paginação e filtros
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { 
      search = '', 
      category = '',
      page = 1,
      limit = 20,
      sort = 'name',
      order = 'asc'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir query dinâmica
    let query = `
      SELECT *, 
      (SELECT COUNT(*) FROM sales WHERE client_id = clients.id) as total_sales
      FROM clients 
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (
        name ILIKE $${paramCount} 
        OR email ILIKE $${paramCount} 
        OR phone ILIKE $${paramCount}
        OR address ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'email', 'total_spent', 'last_purchase', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Total de registros
    let countQuery = 'SELECT COUNT(*) FROM clients WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;
    
    if (search) {
      countQuery += ` AND (
        name ILIKE $${countParamCount} 
        OR email ILIKE $${countParamCount} 
        OR phone ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
      countParamCount++;
    }
    
    if (category) {
      countQuery += ` AND category = $${countParamCount}`;
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

// Buscar cliente por ID
app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT c.*, 
       (SELECT COUNT(*) FROM sales WHERE client_id = c.id) as total_sales,
       (SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE client_id = c.id) as total_revenue,
       (SELECT MAX(sale_date) FROM sales WHERE client_id = c.id) as last_purchase_date
       FROM clients c WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado.'
      });
    }
    
    // Buscar histórico de compras
    const salesResult = await pool.query(
      `SELECT s.id, s.sale_number, s.final_amount, s.sale_date, s.payment_method
       FROM sales s
       WHERE s.client_id = $1
       ORDER BY s.sale_date DESC
       LIMIT 10`,
      [id]
    );
    
    const client = result.rows[0];
    client.sales_history = salesResult.rows;
    
    res.json({
      success: true,
      client
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
    const { name, email, phone, address, city, province, category = 'normal', notes } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nome é obrigatório.'
      });
    }
    
    // Validar email único
    if (email) {
      const emailExists = await pool.query(
        'SELECT id FROM clients WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (emailExists.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está cadastrado.'
        });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, province, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name.trim(),
        email ? email.toLowerCase().trim() : null,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        province ? province.trim() : null,
        category,
        notes ? notes.trim() : null
      ]
    );
    
    res.status(201).json({
      success: true,
      client: result.rows[0],
      message: 'Cliente criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create client error:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: 'Este email já está cadastrado para outro cliente.'
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
    const { name, email, phone, address, city, province, category, notes } = req.body;
    
    // Verificar se cliente existe
    const clientExists = await pool.query(
      'SELECT id, email FROM clients WHERE id = $1',
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
    
    // Verificar se novo email já existe para outro cliente
    if (email && email !== clientExists.rows[0].email) {
      const emailExists = await pool.query(
        'SELECT id FROM clients WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );
      
      if (emailExists.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está cadastrado para outro cliente.'
        });
      }
    }
    
    const result = await pool.query(
      `UPDATE clients 
       SET name = $1, 
           email = $2, 
           phone = $3, 
           address = $4, 
           city = $5, 
           province = $6, 
           category = $7,
           notes = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        name.trim(),
        email ? email.toLowerCase().trim() : null,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        province ? province.trim() : null,
        category || 'normal',
        notes ? notes.trim() : null,
        id
      ]
    );
    
    res.json({
      success: true,
      client: result.rows[0],
      message: 'Cliente atualizado com sucesso!'
    });
    
  } catch (error) {
    console.error('Update client error:', error);
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
      'SELECT COUNT(*) as count FROM sales WHERE client_id = $1',
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
        COUNT(*) as total_clients,
        COUNT(CASE WHEN category = 'VIP' THEN 1 END) as vip_count,
        COUNT(CASE WHEN category = 'corporate' THEN 1 END) as corporate_count,
        COUNT(CASE WHEN category = 'normal' THEN 1 END) as normal_count,
        COALESCE(SUM(total_spent), 0) as total_revenue,
        COUNT(CASE WHEN last_purchase >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_30d,
        COUNT(CASE WHEN last_purchase >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as active_90d,
        COUNT(CASE WHEN last_purchase IS NULL OR last_purchase < CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as inactive_1y,
        COALESCE(AVG(total_spent), 0) as avg_client_value
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

// Buscar clientes rápidos (para autocomplete)
app.get('/api/clients/search/quick', authenticateToken, async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    
    const result = await pool.query(
      `SELECT id, name, email, phone 
       FROM clients 
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
       ORDER BY name
       LIMIT $2`,
      [`%${q}%`, parseInt(limit)]
    );
    
    res.json({
      success: true,
      clients: result.rows
    });
    
  } catch (error) {
    console.error('Quick search error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes.'
    });
  }
});

// ==============================================
// API - PRODUTOS (CRUD COMPLETO)
// ==============================================

// Listar produtos com filtros avançados
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { 
      search = '', 
      category = '',
      low_stock = false,
      out_of_stock = false,
      page = 1,
      limit = 20,
      sort = 'name',
      order = 'asc'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT *, 
      (stock <= min_stock) as is_low_stock,
      (stock = 0) as is_out_of_stock
      FROM products 
      WHERE is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (
        name ILIKE $${paramCount} 
        OR code ILIKE $${paramCount} 
        OR description ILIKE $${paramCount}
        OR supplier ILIKE $${paramCount}
      )`;
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
    
    if (out_of_stock === 'true') {
      query += ` AND stock = 0`;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'code', 'category', 'unit_price', 'stock', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Total de registros
    let countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = true';
    const countParams = [];
    let countParamCount = 1;
    
    if (search) {
      countQuery += ` AND (
        name ILIKE $${countParamCount} 
        OR code ILIKE $${countParamCount} 
        OR description ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
      countParamCount++;
    }
    
    if (category) {
      countQuery += ` AND category = $${countParamCount}`;
      countParams.push(category);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
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

// Buscar produto por ID
app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT p.*, 
       (SELECT COUNT(*) FROM sale_items WHERE product_id = p.id) as total_sales,
       (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE product_id = p.id) as total_quantity_sold,
       (SELECT COALESCE(SUM(total_price), 0) FROM sale_items WHERE product_id = p.id) as total_revenue
       FROM products p WHERE id = $1 AND is_active = true`,
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
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        product: null,
        message: 'Produto não encontrado.'
      });
    }
    
    res.json({
      success: true,
      product: result.rows[0]
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
    const { 
      code, 
      name, 
      description, 
      category, 
      unit_price, 
      cost_price, 
      stock = 0, 
      min_stock = 10, 
      supplier,
      barcode
    } = req.body;
    
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
    
    // Verificar se código já existe
    const codeExists = await pool.query(
      'SELECT id FROM products WHERE code = $1',
      [code.toUpperCase()]
    );
    
    if (codeExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Este código de produto já está cadastrado.'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO products (
        code, name, description, category, unit_price, 
        cost_price, stock, min_stock, supplier, barcode
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        code.toUpperCase().trim(),
        name.trim(),
        description ? description.trim() : null,
        category ? category.trim() : null,
        parseFloat(unit_price),
        cost_price ? parseFloat(cost_price) : null,
        parseInt(stock),
        parseInt(min_stock),
        supplier ? supplier.trim() : null,
        barcode ? barcode.trim() : null
      ]
    );
    
    res.status(201).json({
      success: true,
      product: result.rows[0],
      message: 'Produto criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create product error:', error);
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
    const { 
      name, 
      description, 
      category, 
      unit_price, 
      cost_price, 
      stock, 
      min_stock, 
      supplier,
      barcode
    } = req.body;
    
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
       SET name = $1, 
           description = $2, 
           category = $3, 
           unit_price = $4,
           cost_price = $5, 
           stock = $6, 
           min_stock = $7, 
           supplier = $8,
           barcode = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        name.trim(),
        description ? description.trim() : null,
        category ? category.trim() : null,
        parseFloat(unit_price),
        cost_price ? parseFloat(cost_price) : null,
        stock ? parseInt(stock) : 0,
        min_stock ? parseInt(min_stock) : 10,
        supplier ? supplier.trim() : null,
        barcode ? barcode.trim() : null,
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
    const { quantity, action = 'add', reason = '', notes = '' } = req.body;
    
    if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantidade inválida.'
      });
    }
    
    const qty = parseInt(quantity);
    let query;
    let message;
    
    if (action === 'add') {
      query = 'UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *';
      message = `Estoque adicionado: +${qty} unidades`;
    } else if (action === 'subtract') {
      // Verificar se tem estoque suficiente
      const currentStock = await pool.query(
        'SELECT stock FROM products WHERE id = $1',
        [id]
      );
      
      if (currentStock.rows[0].stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Estoque insuficiente. Disponível: ${currentStock.rows[0].stock}`
        });
      }
      
      query = 'UPDATE products SET stock = stock - $1 WHERE id = $2 RETURNING *';
      message = `Estoque removido: -${qty} unidades`;
    } else if (action === 'set') {
      query = 'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *';
      message = `Estoque definido para: ${qty} unidades`;
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
    
    // Registrar movimento de estoque (se tiver tabela stock_movements)
    try {
      await pool.query(
        `INSERT INTO stock_movements (product_id, quantity, action, reason, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, qty, action, reason || 'Ajuste manual', notes || '', req.userId]
      );
    } catch (stockError) {
      console.log('Stock movements table not available, skipping log');
    }
    
    res.json({
      success: true,
      product: result.rows[0],
      message
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
      'SELECT id, name, code FROM products WHERE id = $1',
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
      'SELECT COUNT(*) as count FROM sale_items WHERE product_id = $1',
      [id]
    );
    
    if (parseInt(inSales.rows[0].count) > 0) {
      // Soft delete
      await pool.query(
        'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
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
        COUNT(*) as total_products,
        COUNT(CASE WHEN stock <= min_stock THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN stock = 0 THEN 1 END) as out_of_stock_count,
        COUNT(DISTINCT category) as categories_count,
        COALESCE(SUM(stock * unit_price), 0) as inventory_value,
        COALESCE(AVG(unit_price), 0) as avg_price,
        COALESCE(SUM(stock), 0) as total_units,
        COALESCE(MIN(unit_price), 0) as min_price,
        COALESCE(MAX(unit_price), 0) as max_price
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

// Buscar produtos rápidos (para venda)
app.get('/api/products/search/quick', authenticateToken, async (req, res) => {
  try {
    const { q = '', limit = 20 } = req.query;
    
    const result = await pool.query(
      `SELECT id, code, name, unit_price, stock, category 
       FROM products 
       WHERE is_active = true 
       AND (name ILIKE $1 OR code ILIKE $1 OR CAST(barcode AS TEXT) ILIKE $1)
       ORDER BY 
         CASE 
           WHEN stock <= min_stock THEN 0 
           ELSE 1 
         END,
         name
       LIMIT $2`,
      [`%${q}%`, parseInt(limit)]
    );
    
    res.json({
      success: true,
      products: result.rows
    });
    
  } catch (error) {
    console.error('Quick products search error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos.'
    });
  }
});

// ==============================================
// API - VENDAS (CRUD COMPLETO E ROBUSTO)
// ==============================================

// Listar vendas com filtros avançados
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date = '',
      end_date = '',
      client_id = '',
      payment_method = '',
      min_amount = '',
      max_amount = '',
      page = 1,
      limit = 20,
      sort = 'sale_date',
      order = 'desc'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT s.*, 
             c.name as client_name,
             c.email as client_email,
             c.phone as client_phone,
             COUNT(si.id) as items_count
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    // Filtros de data
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
    
    if (client_id) {
      query += ` AND s.client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    if (payment_method) {
      query += ` AND s.payment_method = $${paramCount}`;
      params.push(payment_method);
      paramCount++;
    }
    
    if (min_amount) {
      query += ` AND s.final_amount >= $${paramCount}`;
      params.push(parseFloat(min_amount));
      paramCount++;
    }
    
    if (max_amount) {
      query += ` AND s.final_amount <= $${paramCount}`;
      params.push(parseFloat(max_amount));
      paramCount++;
    }
    
    query += ` GROUP BY s.id, c.id`;
    
    // Ordenação segura
    const validSortColumns = ['sale_date', 'final_amount', 'sale_number', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'sale_date';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Total de registros
    let countQuery = 'SELECT COUNT(*) FROM sales WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;
    
    if (start_date) {
      countQuery += ` AND DATE(sale_date) >= $${countParamCount}`;
      countParams.push(start_date);
      countParamCount++;
    }
    
    if (end_date) {
      countQuery += ` AND DATE(sale_date) <= $${countParamCount}`;
      countParams.push(end_date);
      countParamCount++;
    }
    
    if (client_id) {
      countQuery += ` AND client_id = $${countParamCount}`;
      countParams.push(client_id);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    // Total de vendas
    let totalQuery = 'SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE 1=1';
    if (start_date) totalQuery += ` AND DATE(sale_date) >= '${start_date}'`;
    if (end_date) totalQuery += ` AND DATE(sale_date) <= '${end_date}'`;
    if (client_id) totalQuery += ` AND client_id = ${client_id}`;
    
    const totalResult = await pool.query(totalQuery);
    const totalAmount = parseFloat(totalResult.rows[0].total);
    
    res.json({
      success: true,
      sales: result.rows,
      summary: {
        total_amount: totalAmount,
        average_amount: total > 0 ? totalAmount / total : 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar vendas.'
    });
  }
});

// Buscar venda por ID com detalhes completos
app.get('/api/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar venda
    const saleResult = await pool.query(
      `SELECT s.*, 
              c.name as client_name, 
              c.email as client_email,
              c.phone as client_phone,
              c.address as client_address,
              u.name as seller_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.user_id = u.id
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
      `SELECT si.*, 
              p.name as product_name, 
              p.code as product_code,
              p.category as product_category,
              p.unit_price as current_price
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

// Buscar venda por número
app.get('/api/sales/number/:sale_number', authenticateToken, async (req, res) => {
  try {
    const { sale_number } = req.params;
    
    const result = await pool.query(
      'SELECT id FROM sales WHERE sale_number = $1',
      [sale_number]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada.'
      });
    }
    
    res.redirect(`/api/sales/${result.rows[0].id}`);
    
  } catch (error) {
    console.error('Get sale by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar venda.'
    });
  }
});

// Criar venda (transação completa)
app.post('/api/sales', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      client_id, 
      items, 
      discount = 0, 
      tax = 0, 
      payment_method = 'cash', 
      notes = '',
      shipping = 0
    } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário pelo menos um item para a venda.'
      });
    }
    
    // Validar itens antes de iniciar transação
    let subtotal = 0;
    const validatedItems = [];
    
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        throw new Error('Item inválido: produto e quantidade são obrigatórios');
      }
      
      const productResult = await pool.query(
        'SELECT id, unit_price, stock, name, code FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        throw new Error(`Produto ID ${item.product_id} não encontrado ou inativo.`);
      }
      
      const product = productResult.rows[0];
      
      if (product.stock < item.quantity) {
        throw new Error(`Estoque insuficiente para ${product.name} (${product.code}). Disponível: ${product.stock}`);
      }
      
      const itemTotal = product.unit_price * item.quantity;
      subtotal += itemTotal;
      
      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.unit_price,
        total_price: itemTotal,
        product
      });
    }
    
    const total_amount = subtotal;
    const final_amount = subtotal - discount + tax + shipping;
    
    // Gerar número da venda
    const date = new Date();
    const saleNumber = `V${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    await client.query('BEGIN');
    
    // Inserir venda
    const saleResult = await client.query(
      `INSERT INTO sales (
        sale_number, client_id, total_amount, discount, tax, 
        shipping, final_amount, payment_method, notes, user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        saleNumber, 
        client_id || null, 
        total_amount, 
        discount, 
        tax,
        shipping,
        final_amount, 
        payment_method, 
        notes || null,
        req.userId
      ]
    );
    
    const sale = saleResult.rows[0];
    
    // Inserir itens e atualizar estoque
    for (const item of validatedItems) {
      // Inserir item
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale.id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
      
      // Atualizar estoque
      await client.query(
        'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
    // Atualizar cliente (se tiver)
    if (client_id) {
      await client.query(
        `UPDATE clients 
         SET total_spent = total_spent + $1, 
             last_purchase = CURRENT_DATE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [final_amount, client_id]
      );
    }
    
    await client.query('COMMIT');
    
    // Buscar venda completa para retornar
    const completeSaleResult = await pool.query(
      `SELECT s.*, c.name as client_name, c.email as client_email
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
      message: 'Venda realizada com sucesso!',
      receipt: {
        sale_number: saleNumber,
        date: sale.sale_date,
        total: final_amount,
        items_count: validatedItems.length
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create sale error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao realizar venda.'
    });
  } finally {
    client.release();
  }
});

// Cancelar venda
app.post('/api/sales/:id/cancel', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    
    // Verificar se venda existe e não está cancelada
    const saleResult = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND status != $2',
      [id, 'cancelled']
    );
    
    if (saleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada ou já cancelada.'
      });
    }
    
    const sale = saleResult.rows[0];
    
    await client.query('BEGIN');
    
    // Buscar itens para reverter estoque
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
      [id]
    );
    
    // Reverter estoque
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
    // Reverter total gasto do cliente (se tiver)
    if (sale.client_id) {
      await client.query(
        `UPDATE clients 
         SET total_spent = total_spent - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [sale.final_amount, sale.client_id]
      );
    }
    
    // Marcar venda como cancelada
    await client.query(
      `UPDATE sales 
       SET status = 'cancelled', 
           notes = CONCAT(COALESCE(notes, ''), ' | Cancelada: ', $2, ' por ', $3),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, reason || 'Sem motivo informado', req.userName || 'Usuário']
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
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar venda.'
    });
  } finally {
    client.release();
  }
});

// Deletar venda (apenas para admin)
app.delete('/api/sales/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Verificar se venda existe
    const saleExists = await client.query(
      'SELECT id, sale_number, client_id, final_amount FROM sales WHERE id = $1',
      [id]
    );
    
    if (saleExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada.'
      });
    }
    
    const sale = saleExists.rows[0];
    
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
    if (sale.client_id) {
      await client.query(
        `UPDATE clients 
         SET total_spent = total_spent - $1
         WHERE id = $2`,
        [sale.final_amount, sale.client_id]
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
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir venda.'
    });
  } finally {
    client.release();
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
      case 'yesterday':
        dateFilter = 'AND DATE(sale_date) = CURRENT_DATE - INTERVAL \'1 day\'';
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
        COALESCE(MIN(final_amount), 0) as min_sale_value,
        COALESCE(MAX(final_amount), 0) as max_sale_value,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_count,
        COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_count,
        COUNT(CASE WHEN payment_method = 'transfer' THEN 1 END) as transfer_count,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN final_amount ELSE 0 END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN final_amount ELSE 0 END), 0) as transfer_total
      FROM sales
      WHERE status = 'completed'
      ${dateFilter}
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

// Vendas recentes (para dashboard)
app.get('/api/sales/recent', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await pool.query(
      `SELECT s.id, s.sale_number, s.final_amount, s.sale_date, s.payment_method,
              c.name as client_name, c.phone as client_phone,
              COUNT(si.id) as items_count
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN sale_items si ON s.id = si.sale_id
       WHERE s.status = 'completed'
       GROUP BY s.id, c.id
       ORDER BY s.sale_date DESC
       LIMIT $1`,
      [parseInt(limit)]
    );
    
    res.json({
      success: true,
      sales: result.rows
    });
    
  } catch (error) {
    console.error('Recent sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar vendas recentes.'
    });
  }
});

// ==============================================
// API - DASHBOARD (COMPLETO E OTIMIZADO)
// ==============================================

// Métricas principais do dashboard
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    // Executar todas as queries em paralelo para melhor performance
    const [
      salesToday, 
      revenueToday, 
      revenueMonth,
      totalClients, 
      totalProducts, 
      lowStock,
      topProducts,
      recentSales,
      salesChart,
      bestSellers
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM sales WHERE DATE(sale_date) = CURRENT_DATE AND status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE DATE(sale_date) = CURRENT_DATE AND status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE sale_date >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed'"),
      pool.query("SELECT COUNT(*) as count FROM clients"),
      pool.query("SELECT COUNT(*) as count FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND is_active = true AND stock > 0"),
      pool.query(`
        SELECT p.name, p.code, p.category, p.stock,
               COALESCE(SUM(si.quantity), 0) as total_sold,
               COALESCE(SUM(si.total_price), 0) as revenue
        FROM products p
        LEFT JOIN sale_items si ON p.id = si.product_id
        LEFT JOIN sales s ON si.sale_id = s.id AND s.sale_date >= CURRENT_DATE - INTERVAL '7 days'
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.code, p.category, p.stock
        ORDER BY total_sold DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT s.sale_number, s.final_amount, s.sale_date, s.payment_method,
               c.name as client_name, c.phone as client_phone
        FROM sales s
        LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.status = 'completed'
        ORDER BY s.sale_date DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT 
          DATE_TRUNC('day', sale_date) as date,
          COUNT(*) as sales_count,
          COALESCE(SUM(final_amount), 0) as revenue
        FROM sales
        WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
        AND status = 'completed'
        GROUP BY DATE_TRUNC('day', sale_date)
        ORDER BY date
      `),
      pool.query(`
        SELECT 
          p.name,
          p.code,
          p.category,
          SUM(si.quantity) as total_quantity,
          SUM(si.total_price) as total_revenue
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
        AND s.status = 'completed'
        GROUP BY p.id, p.name, p.code, p.category
        ORDER BY total_quantity DESC
        LIMIT 10
      `)
    ]);
    
    // Vendas de ontem para cálculo de crescimento
    const salesYesterday = await pool.query(
      "SELECT COUNT(*) as count FROM sales WHERE DATE(sale_date) = CURRENT_DATE - INTERVAL '1 day' AND status = 'completed'"
    );
    
    const todaySales = parseInt(salesToday.rows[0].count);
    const yesterdaySales = parseInt(salesYesterday.rows[0].count);
    
    let growthPercentage = 0;
    if (yesterdaySales > 0) {
      growthPercentage = ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1);
    } else if (todaySales > 0) {
      growthPercentage = 100;
    }
    
    res.json({
      success: true,
      metrics: {
        sales_today: todaySales,
        revenue_today: parseFloat(revenueToday.rows[0].total),
        revenue_month: parseFloat(revenueMonth.rows[0].total),
        total_clients: parseInt(totalClients.rows[0].count),
        total_products: parseInt(totalProducts.rows[0].count),
        low_stock_items: parseInt(lowStock.rows[0].count),
        sales_yesterday: yesterdaySales,
        growth_percentage: parseFloat(growthPercentage)
      },
      charts: {
        sales_data: salesChart.rows,
        best_sellers: bestSellers.rows
      },
      top_products: topProducts.rows,
      recent_sales: recentSales.rows
    });
    
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas do dashboard.'
    });
  }
});

// Vendas por período para gráficos
app.get('/api/dashboard/sales-chart', authenticateToken, async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    let interval = '7 DAY';
    let groupBy = 'day';
    
    switch (period) {
      case '30days':
        interval = '30 DAY';
        groupBy = 'day';
        break;
      case '90days':
        interval = '90 DAY';
        groupBy = 'week';
        break;
      case 'year':
        interval = '365 DAY';
        groupBy = 'month';
        break;
    }
    
    let dateFormat;
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }
    
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('${groupBy}', sale_date), '${dateFormat}') as period,
        COUNT(*) as sales_count,
        COALESCE(SUM(final_amount), 0) as revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_value
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '${interval}'
      AND status = 'completed'
      GROUP BY DATE_TRUNC('${groupBy}', sale_date)
      ORDER BY DATE_TRUNC('${groupBy}', sale_date) ASC
    `);
    
    res.json({
      success: true,
      period,
      groupBy,
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
    const { limit = 10, period = 'all' } = req.query;
    
    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "AND s.sale_date >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'year') {
      dateFilter = "AND s.sale_date >= DATE_TRUNC('year', CURRENT_DATE)";
    }
    
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.category,
        COUNT(s.id) as purchase_count,
        COALESCE(SUM(s.final_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase
      FROM clients c
      JOIN sales s ON c.id = s.client_id
      WHERE s.status = 'completed'
      ${dateFilter}
      GROUP BY c.id, c.name, c.email, c.category
      ORDER BY total_spent DESC
      LIMIT $1
    `, [parseInt(limit)]);
    
    res.json({
      success: true,
      clients: result.rows,
      period
    });
    
  } catch (error) {
    console.error('Top clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes.'
    });
  }
});

// Métricas rápidas
app.get('/api/dashboard/quick-metrics', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURRENT_DATE AND status = 'completed') as sales_today,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE DATE(sale_date) = CURRENT_DATE AND status = 'completed') as revenue_today,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM products WHERE is_active = true AND stock <= min_stock) as low_stock,
        (SELECT COUNT(*) FROM sales WHERE status = 'pending') as pending_orders,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE status = 'completed' AND sale_date >= CURRENT_DATE - INTERVAL '7 days') as revenue_week
    `);
    
    res.json({
      success: true,
      metrics: result.rows[0]
    });
    
  } catch (error) {
    console.error('Quick metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas rápidas.'
    });
  }
});

// ==============================================
// API - RELATÓRIOS (COMPLETO E PODEROSO)
// ==============================================

// Relatório de vendas detalhado
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date,
      end_date,
      client_id,
      payment_method,
      group_by = 'day',
      export: exportFormat
    } = req.query;
    
    let groupByClause;
    switch (group_by) {
      case 'day':
        groupByClause = "DATE(s.sale_date)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', s.sale_date)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', s.sale_date)";
        break;
      case 'year':
        groupByClause = "DATE_TRUNC('year', s.sale_date)";
        break;
      default:
        groupByClause = "DATE(s.sale_date)";
    }
    
    let query = `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as sales_count,
        COUNT(DISTINCT s.client_id) as unique_clients,
        COALESCE(SUM(s.final_amount), 0) as total_revenue,
        COALESCE(AVG(s.final_amount), 0) as avg_sale_value,
        COALESCE(SUM(s.discount), 0) as total_discount,
        COALESCE(SUM(s.tax), 0) as total_tax,
        COALESCE(SUM(s.shipping), 0) as total_shipping,
        COUNT(CASE WHEN s.payment_method = 'cash' THEN 1 END) as cash_count,
        COUNT(CASE WHEN s.payment_method = 'card' THEN 1 END) as card_count,
        COUNT(CASE WHEN s.payment_method = 'transfer' THEN 1 END) as transfer_count
      FROM sales s
      WHERE s.status = 'completed'
    `;
    
    const params = [];
    let paramCount = 1;
    
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
    
    if (client_id) {
      query += ` AND s.client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }
    
    if (payment_method) {
      query += ` AND s.payment_method = $${paramCount}`;
      params.push(payment_method);
      paramCount++;
    }
    
    query += ` GROUP BY ${groupByClause}`;
    query += ` ORDER BY ${groupByClause}`;
    
    const result = await pool.query(query, params);
    
    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_value,
        COALESCE(MIN(final_amount), 0) as min_sale_value,
        COALESCE(MAX(final_amount), 0) as max_sale_value,
        MIN(sale_date) as first_sale,
        MAX(sale_date) as last_sale,
        COUNT(DISTINCT client_id) as unique_clients_count
      FROM sales
      WHERE status = 'completed'
      ${start_date ? `AND sale_date >= '${start_date}'` : ''}
      ${end_date ? `AND sale_date <= '${end_date}'` : ''}
      ${client_id ? `AND client_id = ${client_id}` : ''}
      ${payment_method ? `AND payment_method = '${payment_method}'` : ''}
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    // Produtos mais vendidos no período
    const topProductsQuery = `
      SELECT 
        p.name,
        p.code,
        p.category,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue,
        COUNT(DISTINCT s.id) as times_sold
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      ${start_date ? `AND s.sale_date >= '${start_date}'` : ''}
      ${end_date ? `AND s.sale_date <= '${end_date}'` : ''}
      ${client_id ? `AND s.client_id = ${client_id}` : ''}
      GROUP BY p.id, p.name, p.code, p.category
      ORDER BY total_quantity DESC
      LIMIT 10
    `;
    
    const topProductsResult = await pool.query(topProductsQuery);
    
    const report = {
      period: {
        start: start_date || 'Início dos registros',
        end: end_date || 'Hoje',
        group_by: group_by
      },
      summary: statsResult.rows[0],
      data: result.rows,
      top_products: topProductsResult.rows,
      generated_at: new Date().toISOString(),
      generated_by: req.userName || req.userEmail
    };
    
    // Exportar para CSV se solicitado
    if (exportFormat === 'csv') {
      const csvData = convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=vendas-${new Date().toISOString().slice(0,10)}.csv`);
      return res.send(csvData);
    }
    
    res.json({
      success: true,
      report
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
      low_stock_only = false,
      out_of_stock_only = false,
      min_price = '',
      max_price = '',
      sort_by = 'revenue',
      sort_order = 'desc',
      export: exportFormat
    } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.category,
        p.unit_price,
        p.cost_price,
        p.stock,
        p.min_stock,
        p.supplier,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.quantity * p.cost_price), 0) as total_cost,
        CASE 
          WHEN p.stock = 0 THEN 'ESGOTADO'
          WHEN p.stock <= p.min_stock THEN 'BAIXO'
          WHEN p.stock <= p.min_stock * 2 THEN 'ALERTA'
          ELSE 'NORMAL'
        END as stock_status,
        (COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.quantity * p.cost_price), 0)) as total_profit,
        CASE 
          WHEN COALESCE(SUM(si.quantity * p.cost_price), 0) > 0 
          THEN ((COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.quantity * p.cost_price), 0)) / COALESCE(SUM(si.quantity * p.cost_price), 0) * 100)
          ELSE 0
        END as profit_margin
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
      WHERE p.is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
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
    
    if (category) {
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (low_stock_only === 'true') {
      query += ` AND p.stock <= p.min_stock`;
    }
    
    if (out_of_stock_only === 'true') {
      query += ` AND p.stock = 0`;
    }
    
    if (min_price) {
      query += ` AND p.unit_price >= $${paramCount}`;
      params.push(parseFloat(min_price));
      paramCount++;
    }
    
    if (max_price) {
      query += ` AND p.unit_price <= $${paramCount}`;
      params.push(parseFloat(max_price));
      paramCount++;
    }
    
    query += ` GROUP BY p.id, p.code, p.name, p.category, p.unit_price, p.cost_price, p.stock, p.min_stock, p.supplier`;
    
    // Ordenação segura
    const validSortColumns = ['name', 'code', 'category', 'unit_price', 'stock', 'total_sold', 'total_revenue', 'profit_margin'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'total_revenue';
    const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    
    const result = await pool.query(query, params);
    
    // Resumo
    const summary = {
      total_products: result.rowCount,
      low_stock: result.rows.filter(p => p.stock_status === 'BAIXO').length,
      out_of_stock: result.rows.filter(p => p.stock_status === 'ESGOTADO').length,
      warning_stock: result.rows.filter(p => p.stock_status === 'ALERTA').length,
      total_inventory_value: result.rows.reduce((sum, p) => sum + (p.unit_price * p.stock), 0),
      total_revenue: result.rows.reduce((sum, p) => sum + (p.total_revenue || 0), 0),
      total_profit: result.rows.reduce((sum, p) => sum + (p.total_profit || 0), 0),
      categories_count: [...new Set(result.rows.map(p => p.category))].filter(c => c).length
    };
    
    // Produtos que nunca venderam
    const neverSold = result.rows.filter(p => p.total_sold === 0);
    
    const report = {
      period: {
        start: start_date || 'Início dos registros',
        end: end_date || 'Hoje'
      },
      filters: {
        category: category || 'Todas',
        stock_filter: low_stock_only === 'true' ? 'Apenas baixo estoque' : 
                     out_of_stock_only === 'true' ? 'Apenas esgotados' : 'Todos'
      },
      summary,
      products: result.rows,
      never_sold: neverSold.length,
      generated_at: new Date().toISOString()
    };
    
    // Exportar para CSV se solicitado
    if (exportFormat === 'csv') {
      const csvData = convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=produtos-${new Date().toISOString().slice(0,10)}.csv`);
      return res.send(csvData);
    }
    
    res.json({
      success: true,
      report
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
      category,
      min_purchases = '',
      min_amount = '',
      sort_by = 'total_spent',
      sort_order = 'desc',
      export: exportFormat
    } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.category,
        c.address,
        c.city,
        c.province,
        c.total_spent,
        c.last_purchase,
        COUNT(s.id) as total_purchases,
        COALESCE(SUM(s.final_amount), 0) as period_spent,
        COALESCE(AVG(s.final_amount), 0) as avg_purchase_value,
        MIN(s.sale_date) as first_purchase,
        MAX(s.sale_date) as last_purchase_date,
        CASE 
          WHEN c.last_purchase >= CURRENT_DATE - INTERVAL '30 days' THEN 'ATIVO'
          WHEN c.last_purchase >= CURRENT_DATE - INTERVAL '90 days' THEN 'INATIVO_RECENTE'
          WHEN c.last_purchase >= CURRENT_DATE - INTERVAL '365 days' THEN 'INATIVO'
          ELSE 'MUITO_INATIVO'
        END as activity_status,
        DENSE_RANK() OVER (ORDER BY COALESCE(SUM(s.final_amount), 0) DESC) as revenue_rank
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.status = 'completed'
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
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
    
    if (category) {
      query += ` AND c.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ` GROUP BY c.id, c.name, c.email, c.phone, c.category, c.address, c.city, c.province, c.total_spent, c.last_purchase`;
    
    // Filtros HAVING
    const havingConditions = [];
    
    if (min_purchases) {
      havingConditions.push(`COUNT(s.id) >= $${paramCount}`);
      params.push(parseInt(min_purchases));
      paramCount++;
    }
    
    if (min_amount) {
      havingConditions.push(`COALESCE(SUM(s.final_amount), 0) >= $${paramCount}`);
      params.push(parseFloat(min_amount));
      paramCount++;
    }
    
    if (havingConditions.length > 0) {
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }
    
    // Ordenação segura
    const validSortColumns = ['name', 'category', 'total_spent', 'total_purchases', 'last_purchase', 'period_spent', 'revenue_rank'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'period_spent';
    const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    
    const result = await pool.query(query, params);
    
    // Resumo
    const summary = {
      total_clients: result.rowCount,
      active_clients: result.rows.filter(c => c.activity_status === 'ATIVO').length,
      vip_clients: result.rows.filter(c => c.category === 'VIP').length,
      corporate_clients: result.rows.filter(c => c.category === 'corporate').length,
      total_revenue: result.rows.reduce((sum, c) => sum + (c.period_spent || 0), 0),
      avg_client_value: result.rowCount > 0 ? result.rows.reduce((sum, c) => sum + (c.period_spent || 0), 0) / result.rowCount : 0,
      new_clients_30d: 0 // Seria preciso data de criação do cliente
    };
    
    // Clientes por status de atividade
    const activityStats = {
      active: result.rows.filter(c => c.activity_status === 'ATIVO').length,
      recent_inactive: result.rows.filter(c => c.activity_status === 'INATIVO_RECENTE').length,
      inactive: result.rows.filter(c => c.activity_status === 'INATIVO').length,
      very_inactive: result.rows.filter(c => c.activity_status === 'MUITO_INATIVO').length
    };
    
    const report = {
      period: {
        start: start_date || 'Início dos registros',
        end: end_date || 'Hoje'
      },
      filters: {
        category: category || 'Todas',
        min_purchases: min_purchases || 'Qualquer',
        min_amount: min_amount || 'Qualquer'
      },
      summary,
      activity_stats: activityStats,
      clients: result.rows,
      generated_at: new Date().toISOString()
    };
    
    // Exportar para CSV se solicitado
    if (exportFormat === 'csv') {
      const csvData = convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=clientes-${new Date().toISOString().slice(0,10)}.csv`);
      return res.send(csvData);
    }
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Clients report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório de clientes.'
    });
  }
});

// Relatório financeiro
app.get('/api/reports/financial', authenticateToken, async (req, res) => {
  try {
    const { 
      start_date,
      end_date,
      group_by = 'month'
    } = req.query;
    
    let groupByClause;
    switch (group_by) {
      case 'day':
        groupByClause = "DATE(s.sale_date)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', s.sale_date)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', s.sale_date)";
        break;
      case 'quarter':
        groupByClause = "DATE_TRUNC('quarter', s.sale_date)";
        break;
      case 'year':
        groupByClause = "DATE_TRUNC('year', s.sale_date)";
        break;
      default:
        groupByClause = "DATE_TRUNC('month', s.sale_date)";
    }
    
    const result = await pool.query(`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as total_sales,
        COALESCE(SUM(s.final_amount), 0) as revenue,
        COALESCE(SUM(s.discount), 0) as total_discounts,
        COALESCE(SUM(s.tax), 0) as total_taxes,
        COALESCE(SUM(s.shipping), 0) as total_shipping,
        COALESCE(SUM(p.cost_price * si.quantity), 0) as total_cost,
        (COALESCE(SUM(s.final_amount), 0) - COALESCE(SUM(p.cost_price * si.quantity), 0)) as gross_profit,
        CASE 
          WHEN COALESCE(SUM(p.cost_price * si.quantity), 0) > 0 
          THEN ((COALESCE(SUM(s.final_amount), 0) - COALESCE(SUM(p.cost_price * si.quantity), 0)) / COALESCE(SUM(p.cost_price * si.quantity), 0) * 100)
          ELSE 0
        END as gross_margin,
        COUNT(DISTINCT s.client_id) as unique_clients,
        COUNT(DISTINCT si.product_id) as unique_products
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed'
      ${start_date ? `AND s.sale_date >= '${start_date}'` : ''}
      ${end_date ? `AND s.sale_date <= '${end_date}'` : ''}
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause}
    `);
    
    // Totais gerais
    const totals = await pool.query(`
      SELECT 
        COALESCE(SUM(s.final_amount), 0) as total_revenue,
        COALESCE(SUM(p.cost_price * si.quantity), 0) as total_cost,
        (COALESCE(SUM(s.final_amount), 0) - COALESCE(SUM(p.cost_price * si.quantity), 0)) as total_profit,
        COUNT(DISTINCT s.client_id) as total_clients,
        COUNT(DISTINCT si.product_id) as total_products
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed'
      ${start_date ? `AND s.sale_date >= '${start_date}'` : ''}
      ${end_date ? `AND s.sale_date <= '${end_date}'` : ''}
    `);
    
    res.json({
      success: true,
      report: {
        period: {
          start: start_date || 'Início dos registros',
          end: end_date || 'Hoje',
          group_by: group_by
        },
        data: result.rows,
        totals: totals.rows[0],
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Financial report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório financeiro.'
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

function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Adicionar cabeçalho
  csvRows.push(headers.join(','));
  
  // Adicionar dados
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escapar vírgulas e aspas
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// ==============================================
// INICIALIZAÇÃO DO BANCO DE DADOS (APRIMORADA)
// ==============================================
async function initializeDatabase() {
  try {
    console.log('🔄 Inicializando banco de dados...');
    
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
        notes TEXT,
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
        barcode VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
      -- Vendas
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(12, 2) NOT NULL,
        discount DECIMAL(12, 2) DEFAULT 0,
        tax DECIMAL(12, 2) DEFAULT 0,
        shipping DECIMAL(12, 2) DEFAULT 0,
        final_amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
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
      
      -- Movimentos de estoque (opcional)
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL, -- add, subtract, set
        reason VARCHAR(100),
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Criar índices para performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
      CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);
      CREATE INDEX IF NOT EXISTS idx_clients_last_purchase ON clients(last_purchase);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
      CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
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
    
    // Verificar se já existem dados
    const clientsExist = await pool.query('SELECT COUNT(*) FROM clients');
    const productsExist = await pool.query('SELECT COUNT(*) FROM products');
    const salesExist = await pool.query('SELECT COUNT(*) FROM sales');
    
    // Inserir dados de exemplo se o banco estiver vazio
    if (parseInt(clientsExist.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO clients (name, email, phone, category, address, city, province) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'VIP', 'Av. 25 de Setembro 123', 'Maputo', 'Maputo'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'normal', 'Rua da Sé 456', 'Matola', 'Maputo'),
        ('Empresa XYZ Ltda', 'contato@xyz.com', '+258843456789', 'corporate', 'Av. Kim Il Sung 789', 'Maputo', 'Maputo'),
        ('Carlos Mendes', 'carlos@email.com', '+258844567890', 'normal', 'Bairro Central 101', 'Beira', 'Sofala'),
        ('Ana Pereira', 'ana@email.com', '+258845678901', 'VIP', 'Zona Verde 202', 'Nampula', 'Nampula'),
        ('Pedro Costa', 'pedro@email.com', '+258846789012', 'normal', 'Museu 303', 'Inhambane', 'Inhambane'),
        ('Luísa Fernandes', 'luisa@email.com', '+258847890123', 'corporate', 'Praça 404', 'Quelimane', 'Zambézia'),
        ('Miguel Soares', 'miguel@email.com', '+258848901234', 'normal', 'Marginal 505', 'Tete', 'Tete'),
        ('Sofia Rodrigues', 'sofia@email.com', '+258849012345', 'VIP', 'Centro 606', 'Lichinga', 'Niassa'),
        ('Ricardo Almeida', 'ricardo@email.com', '+258841234560', 'corporate', 'Comercial 707', 'Pemba', 'Cabo Delgado')
      `);
      console.log('👥 10 clientes de exemplo criados');
    }
    
    if (parseInt(productsExist.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO products (code, name, description, category, unit_price, cost_price, stock, min_stock, supplier) VALUES
        ('PROD001', 'Arroz Nacional 5kg', 'Arroz de qualidade premium 5kg', 'Alimentos', 350.00, 280.00, 100, 20, 'Distribuidora Moçambique'),
        ('PROD002', 'Azeite Virgem 1L', 'Azeite extra virgem importado', 'Alimentos', 850.00, 650.00, 50, 10, 'Importadora Lusitana'),
        ('PROD003', 'Detergente Líquido 2L', 'Detergente para louça concentrado', 'Limpeza', 45.00, 32.00, 200, 50, 'Indústrias Clean'),
        ('PROD004', 'Sabonete Líquido 500ml', 'Sabonete líquido antibacteriano', 'Higiene', 25.00, 18.00, 150, 30, 'Higiene Total'),
        ('PROD005', 'Leite UHT 1L', 'Leite longa vida integral', 'Laticínios', 60.00, 45.00, 80, 20, 'Lácteos Naturais'),
        ('PROD006', 'Café Torrado 250g', 'Café torrado moído na hora', 'Alimentos', 250.00, 180.00, 120, 30, 'Café Moçambique'),
        ('PROD007', 'Açúcar Refinado 1kg', 'Açúcar branco refinado', 'Alimentos', 80.00, 60.00, 200, 50, 'Açucareira Nacional'),
        ('PROD008', 'Óleo Vegetal 1L', 'Óleo de soja refinado', 'Alimentos', 120.00, 85.00, 100, 25, 'Óleos Vegetais'),
        ('PROD009', 'Macarrão Espaguete 500g', 'Macarrão tipo espaguete', 'Alimentos', 45.00, 32.00, 150, 40, 'Massas Italianas'),
        ('PROD010', 'Sabão em Pó 1kg', 'Sabão em pó para roupas', 'Limpeza', 95.00, 70.00, 75, 20, 'Clean Wash'),
        ('PROD011', 'Desinfetante 2L', 'Desinfetante aroma pinho', 'Limpeza', 65.00, 48.00, 90, 25, 'Limpeza Profissional'),
        ('PROD012', 'Shampoo 400ml', 'Shampoo para todos os tipos de cabelo', 'Higiene', 85.00, 60.00, 60, 15, 'Cuidados Pessoais'),
        ('PROD013', 'Condicionador 400ml', 'Condicionador reparador', 'Higiene', 90.00, 65.00, 55, 15, 'Cuidados Pessoais'),
        ('PROD014', 'Creme Dental 90g', 'Pasta dental com flúor', 'Higiene', 35.00, 25.00, 120, 30, 'Sorriso Saudável'),
        ('PROD015', 'Papel Higiênico 4un', 'Papel higiênico macio 4 rolos', 'Higiene', 40.00, 28.00, 180, 50, 'Papéis Finos')
      `);
      console.log('📦 15 produtos de exemplo criados');
    }
    
    if (parseInt(salesExist.rows[0].count) === 0) {
      // Criar algumas vendas de exemplo
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      // Venda 1 (hoje)
      const sale1 = await pool.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method, user_id, sale_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [`V${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}001`, 1, 1200, 50, 0, 1150, 'cash', 1, today]
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
      
      // Venda 2 (ontem)
      const sale2 = await pool.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method, user_id, sale_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [`V${yesterday.getFullYear()}${(yesterday.getMonth() + 1).toString().padStart(2, '0')}${yesterday.getDate().toString().padStart(2, '0')}002`, 2, 325, 0, 0, 325, 'card', 1, yesterday]
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
      
      // Venda 3 (semana passada)
      const sale3 = await pool.query(
        `INSERT INTO sales (sale_number, client_id, total_amount, discount, tax, final_amount, payment_method, user_id, sale_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [`V${lastWeek.getFullYear()}${(lastWeek.getMonth() + 1).toString().padStart(2, '0')}${lastWeek.getDate().toString().padStart(2, '0')}003`, 3, 2450, 100, 0, 2350, 'transfer', 1, lastWeek]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale3.rows[0].id, 5, 10, 60, 600]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale3.rows[0].id, 6, 5, 250, 1250]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale3.rows[0].id, 7, 2, 80, 160]
      );
      
      await pool.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [sale3.rows[0].id, 8, 2, 120, 240]
      );
      
      console.log('💰 3 vendas de exemplo criadas');
    }
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    console.log(`📊 Clientes: ${clientsExist.rows[0].count}`);
    console.log(`📦 Produtos: ${productsExist.rows[0].count}`);
    console.log(`💰 Vendas: ${salesExist.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    console.log('🔄 Continuando sem dados de exemplo...');
  }
}

// ==============================================
// SERVE FRONTEND ESTÁTICO COM ROTEAMENTO SPA
// ==============================================

// Servir arquivos estáticos
app.use(express.static('.', {
  setHeaders: (res, path) => {
    // Headers específicos para arquivos JavaScript
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Cache control
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Rotas específicas para arquivos HTML
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/clients', (req, res) => {
  res.sendFile(path.join(__dirname, 'clients.html'));
});

app.get('/products', (req, res) => {
  res.sendFile(path.join(__dirname, 'products.html'));
});

app.get('/sales', (req, res) => {
  res.sendFile(path.join(__dirname, 'sales.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'reports.html'));
});

// Rota catch-all para SPA (deve ser a última rota)
app.get('*', (req, res) => {
  // Não interceptar requisições de API
  if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/status')) {
    return res.status(404).json({
      success: false,
      message: 'Endpoint não encontrado.'
    });
  }
  
  // Servir index.html para todas as outras rotas
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error('💥 Erro não tratado:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Ocorreu um erro interno no servidor.' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada.'
  });
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
async function startServer() {
  try {
    console.log('='.repeat(60));
    console.log('🚀 INICIANDO BIZZFLOW CRM v3.1');
    console.log('='.repeat(60));
    
    // Inicializar banco de dados
    await initializeDatabase();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM v3.1 - ONLINE                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║ Status:        ✅ SERVIDOR ATIVO                                        ║
║ Ambiente:      ${process.env.NODE_ENV || 'development'.padEnd(42)} ║
║ Porta:         ${PORT.toString().padEnd(45)} ║
║ URL Local:     http://localhost:${PORT.toString().padEnd(40)} ║
║ URL Produção:  https://bizzflow-crm.onrender.com                        ║
║ Banco:         PostgreSQL (Render.com)                                  ║
║                                                                          ║
║ 📊 DADOS DISPONÍVEIS:                                                   ║
║   • Usuário admin: admin@bizzflow.com / admin123                       ║
║   • Clientes de exemplo: 10 registros                                   ║
║   • Produtos de exemplo: 15 registros                                   ║
║   • Vendas de exemplo: 3 registros                                      ║
║                                                                          ║
║ 🔧 ENDPOINTS PRINCIPAIS:                                                ║
║   • /health              → Status do sistema                            ║
║   • /api/auth/login      → Autenticação                                 ║
║   • /api/clients         → Gerenciamento de clientes                    ║
║   • /api/products        → Gerenciamento de produtos                    ║
║   • /api/sales           → Gerenciamento de vendas                      ║
║   • /api/dashboard       → Dashboard com métricas                       ║
║   • /api/reports         → Relatórios completos                         ║
║                                                                          ║
║ ⚠️  SOLUÇÃO DE PROBLEMAS:                                               ║
║   • CSP Corrigido: Scripts externos permitidos                          ║
║   • CORS Configurado: Frontend pode acessar API                         ║
║   • Keep-alive: Ativado (14 minutos)                                    ║
║   • Erros tratados: Mensagens amigáveis                                 ║
╚══════════════════════════════════════════════════════════════════════════╝
      `);
      console.log(`🕐 Servidor iniciado em: ${new Date().toLocaleString()}`);
      console.log(`📡 Aguardando conexões...`);
    });
    
  } catch (error) {
    console.error('❌ Falha catastrófica ao iniciar servidor:', error);
    console.log('💡 Verifique:');
    console.log('  1. Variáveis de ambiente no Render.com');
    console.log('  2. Conexão com banco de dados PostgreSQL');
    console.log('  3. Porta disponível');
    process.exit(1);
  }
}

// Iniciar servidor
startServer();
