// ==============================================
// BIZZFLOW CRM v3.3 - SERVER COMPLETO FUNCIONAL
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
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ==============================================
// MIDDLEWARE SEGURO SEM BLOQUEIO
// ==============================================

// Configurar Helmet com CSP PERMISSIVO (para funcionar)
app.use(helmet({
  contentSecurityPolicy: false, // DESATIVAR CSP TEMPORARIAMENTE
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false
}));

// Configurar CORS PARA FUNCIONAR
app.use(cors({
  origin: '*', // Permitir todas as origens
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

// Headers de segurança customizados
app.use((req, res, next) => {
  res.header('X-Powered-By', 'BizzFlow CRM v3.3');
  res.header('X-Content-Type-Options', 'nosniff');
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.status(200).end();
  }
  
  next();
});

// ==============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==============================================
const authenticateToken = async (req, res, next) => {
  try {
    // Múltiplas formas de obter o token
    let token = null;
    
    // 1. Do header Authorization
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    
    // 2. Do query string
    else if (req.query.token) {
      token = req.query.token;
    }
    
    // 3. Do header personalizado
    else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }
    
    if (!token) {
      console.log('⚠️ Token não fornecido');
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido.'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024');
    
    // Verificar se usuário ainda existe
    const userResult = await pool.query(
      'SELECT id, email, role, name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }
    
    if (!userResult.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inativo.'
      });
    }
    
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    req.userName = decoded.name;
    
    next();
  } catch (error) {
    console.error('❌ Erro na verificação do token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado. Faça login novamente.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Falha na autenticação.'
    });
  }
};

// ==============================================
// ROTAS PÚBLICAS
// ==============================================

// Health Check - SEMPRE FUNCIONA
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    
    res.json({
      success: true,
      status: 'healthy',
      service: 'BizzFlow CRM API',
      version: '3.3.0',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
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
    success: true,
    status: 'online',
    service: 'BizzFlow CRM',
    version: '3.3.0',
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleString('pt-BR'),
    endpoints: {
      health: '/health',
      login: '/api/auth/login',
      clients: '/api/clients',
      products: '/api/products',
      sales: '/api/sales',
      dashboard: '/api/dashboard/metrics'
    }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API BizzFlow CRM está funcionando! 🚀',
    timestamp: new Date().toISOString(),
    docs: 'Use POST /api/auth/login com {email: "admin@bizzflow.com", password: "admin123"}'
  });
});

// Keep-alive endpoint
app.get('/keep-alive', (req, res) => {
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Servidor ativo e respondendo'
  });
});

// ==============================================
// API - AUTENTICAÇÃO (LOGIN CORRIGIDO)
// ==============================================

// LOGIN - ENDPOINT PRINCIPAL CORRIGIDO
app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Tentativa de login recebida');
  
  try {
    const { email, password } = req.body;
    
    console.log('📧 Email recebido:', email ? 'Sim' : 'Não');
    console.log('🔑 Senha recebida:', password ? 'Sim' : 'Não');
    
    // Validação básica
    if (!email || !password) {
      console.log('❌ Dados incompletos');
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios.'
      });
    }
    
    console.log('🔍 Buscando usuário no banco...');
    
    // Buscar usuário no banco
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    console.log('👥 Usuários encontrados:', userResult.rows.length);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuário não encontrado');
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }
    
    const user = userResult.rows[0];
    console.log('👤 Usuário encontrado:', user.email);
    
    // Verificar se usuário está ativo
    if (!user.is_active) {
      console.log('❌ Usuário inativo');
      return res.status(401).json({
        success: false,
        message: 'Conta desativada. Contate o administrador.'
      });
    }
    
    // Verificar senha
    console.log('🔒 Verificando senha...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Senha incorreta');
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }
    
    console.log('✅ Senha válida');
    
    // Criar payload do token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'user',
      name: user.name || 'Usuário'
    };
    
    // Gerar token JWT
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024',
      { expiresIn: '7d' }
    );
    
    console.log('🎫 Token gerado com sucesso');
    
    // Atualizar último login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Preparar resposta do usuário (remover senha)
    const { password: _, ...userResponse } = user;
    
    console.log('✅ Login bem-sucedido para:', user.email);
    
    // Resposta de sucesso
    res.json({
      success: true,
      message: 'Login realizado com sucesso!',
      token: token,
      user: userResponse,
      expiresIn: '7d',
      redirectTo: '/dashboard'
    });
    
  } catch (error) {
    console.error('💥 ERRO NO LOGIN:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Erro interno no servidor. Tente novamente.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Validar token (para verificar se ainda é válido)
app.get('/api/auth/validate', authenticateToken, async (req, res) => {
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

// Perfil do usuário logado
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

// Criar usuário inicial (se não existir)
app.post('/api/auth/setup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios.'
      });
    }
    
    // Verificar se já existe algum usuário
    const existingUsers = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (parseInt(existingUsers.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Sistema já possui usuários cadastrados.'
      });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário admin
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashedPassword]
    );
    
    // Gerar token
    const token = jwt.sign(
      {
        userId: result.rows[0].id,
        email: result.rows[0].email,
        role: 'admin',
        name: result.rows[0].name
      },
      process.env.JWT_SECRET || 'bizzflow-crm-secret-key-2024',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Usuário administrador criado com sucesso!',
      token: token,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao configurar usuário.'
    });
  }
});

// ==============================================
// API - CLIENTES (SIMPLIFICADO PARA FUNCIONAR)
// ==============================================

// Listar clientes
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients ORDER BY created_at DESC LIMIT 100'
    );
    
    res.json({
      success: true,
      clients: result.rows,
      total: result.rowCount
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
    res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente.'
    });
  }
});

// ==============================================
// API - PRODUTOS
// ==============================================

// Listar produtos
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 100'
    );
    
    res.json({
      success: true,
      products: result.rows,
      total: result.rowCount
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

// ==============================================
// API - VENDAS
// ==============================================

// Listar vendas
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.name as client_name 
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       ORDER BY s.created_at DESC 
       LIMIT 50`
    );
    
    res.json({
      success: true,
      sales: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar vendas.'
    });
  }
});

// ==============================================
// API - DASHBOARD (SIMPLIFICADO)
// ==============================================

// Métricas do dashboard
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const [
      salesToday, 
      revenueToday, 
      totalClients, 
      totalProducts, 
      lowStock
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COALESCE(SUM(final_amount), 0) as total FROM sales WHERE DATE(sale_date) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) as count FROM clients"),
      pool.query("SELECT COUNT(*) as count FROM products WHERE is_active = true"),
      pool.query("SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND is_active = true")
    ]);
    
    res.json({
      success: true,
      metrics: {
        sales_today: parseInt(salesToday.rows[0].count),
        revenue_today: parseFloat(revenueToday.rows[0].total),
        total_clients: parseInt(totalClients.rows[0].count),
        total_products: parseInt(totalProducts.rows[0].count),
        low_stock_items: parseInt(lowStock.rows[0].count)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas.',
      metrics: {
        sales_today: 0,
        revenue_today: 0,
        total_clients: 0,
        total_products: 0,
        low_stock_items: 0
      }
    });
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
        total_spent DECIMAL(12, 2) DEFAULT 0,
        last_purchase DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        supplier VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
      
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
    } else {
      console.log('✅ Usuário admin já existe');
    }
    
    // Verificar se há dados de exemplo
    const clientsCount = await pool.query('SELECT COUNT(*) as count FROM clients');
    const productsCount = await pool.query('SELECT COUNT(*) as count FROM products');
    
    console.log(`📊 Clientes: ${clientsCount.rows[0].count}`);
    console.log(`📦 Produtos: ${productsCount.rows[0].count}`);
    
    if (parseInt(clientsCount.rows[0].count) === 0) {
      console.log('👥 Criando clientes de exemplo...');
      await pool.query(`
        INSERT INTO clients (name, email, phone, category) VALUES
        ('João Silva', 'joao@email.com', '+258841234567', 'VIP'),
        ('Maria Santos', 'maria@email.com', '+258842345678', 'normal'),
        ('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'corporate')
      `);
    }
    
    if (parseInt(productsCount.rows[0].count) === 0) {
      console.log('📦 Criando produtos de exemplo...');
      await pool.query(`
        INSERT INTO products (code, name, category, unit_price, stock, min_stock) VALUES
        ('PROD001', 'Arroz 5kg', 'Alimentos', 350.00, 100, 20),
        ('PROD002', 'Azeite 1L', 'Alimentos', 850.00, 50, 10),
        ('PROD003', 'Detergente', 'Limpeza', 45.00, 200, 50)
      `);
    }
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
    console.log('🔄 Continuando sem inicialização completa...');
  }
}

// ==============================================
// SERVE FRONTEND ESTÁTICO
// ==============================================

// Servir arquivos estáticos da raiz
app.use(express.static('.', {
  setHeaders: (res, path) => {
    // Cache para arquivos estáticos
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') || path.endsWith('.jpg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Rota para dashboard
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

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota catch-all para SPA
app.get('*', (req, res) => {
  // Não interceptar API routes
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
  console.error('💥 Erro não tratado:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Ocorreu um erro interno no servidor.' 
      : err.message
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'Endpoint da API não encontrado.'
    });
  }
  
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// ==============================================
// INICIAR SERVIDOR
// ==============================================
async function startServer() {
  try {
    console.log('='.repeat(60));
    console.log('🚀 INICIANDO BIZZFLOW CRM v3.3');
    console.log('='.repeat(60));
    
    // Inicializar banco
    await initializeDatabase();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM v3.3 - ONLINE                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║ ✅ STATUS:         SERVIDOR ATIVO                                       ║
║ 📍 PORTA:          ${PORT.toString().padEnd(45)} ║
║ 🌍 AMBIENTE:       ${(process.env.NODE_ENV || 'development').padEnd(44)} ║
║ 🔗 URL LOCAL:      http://localhost:${PORT.toString().padEnd(40)} ║
║ 🌐 URL PRODUÇÃO:   https://bizzflow-crm.onrender.com                    ║
║                                                                          ║
║ 👤 LOGIN PADRÃO:                                                        ║
║   • Email: admin@bizzflow.com                                           ║
║   • Senha: admin123                                                     ║
║                                                                          ║
║ 🔧 ENDPOINTS TESTAR:                                                    ║
║   1. ${'https://bizzflow-crm.onrender.com/health'.padEnd(48)} ║
║   2. ${'https://bizzflow-crm.onrender.com/api/test'.padEnd(48)} ║
║   3. ${'POST /api/auth/login'.padEnd(48)} ║
║                                                                          ║
║ ⚡ CORREÇÕES APLICADAS:                                                  ║
║   • CSP DESATIVADO temporariamente                                      ║
║   • LOGIN 100% funcional                                                ║
║   • CORS configurado para todas origens                                 ║
║   • Banco inicializado automaticamente                                  ║
╚══════════════════════════════════════════════════════════════════════════╝
      `);
      console.log(`🕐 Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
      console.log(`📡 Aguardando conexões...`);
    });
    
  } catch (error) {
    console.error('❌ FALHA CATASTRÓFICA AO INICIAR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();
