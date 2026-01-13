// ==============================================
// BIZZFLOW CRM v2.0 - SERVER COM POSTGRESQL
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Headers de segurança
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

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
      version: '2.0.0'
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
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
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
      'SELECT * FROM users WHERE email = $1',
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
      { userId: user.id, email: user.email, role: user.role },
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

// ==============================================
// API - CLIENTES
// ==============================================

// Listar clientes
app.get('/api/clients', async (req, res) => {
  try {
    const { search = '', limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
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

// Criar cliente
app.post('/api/clients', async (req, res) => {
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
      [name, email, phone, address, city, province, category || 'normal']
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
app.get('/api/products', async (req, res) => {
  try {
    const { search = '', limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
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

// Criar produto
app.post('/api/products', async (req, res) => {
  try {
    const { code, name, description, category, unit_price, stock, min_stock } = req.body;
    
    if (!code || !name || !unit_price) {
      return res.status(400).json({
        success: false,
        message: 'Código, nome e preço são obrigatórios.'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO products (code, name, description, category, unit_price, stock, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, name, description, category, unit_price, stock || 0, min_stock || 10]
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

// ==============================================
// API - VENDAS
// ==============================================

// Criar venda
app.post('/api/sales', async (req, res) => {
  try {
    const { client_id, items, discount = 0, tax = 0, payment_method = 'cash', notes = '' } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'É necessário pelo menos um item para a venda.'
      });
    }
    
    // Calcular totais
    let subtotal = 0;
    for (const item of items) {
      const productResult = await pool.query(
        'SELECT unit_price, stock FROM products WHERE id = $1',
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
          message: `Estoque insuficiente para produto ID ${item.product_id}. Disponível: ${product.stock}`
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
        [saleNumber, client_id, total_amount, discount, tax, final_amount, payment_method, notes]
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
      
      // Atualizar cliente
      if (client_id) {
        await client.query(
          `UPDATE clients 
           SET total_spent = total_spent + $1, last_purchase = CURRENT_DATE
           WHERE id = $2`,
          [final_amount, client_id]
        );
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        sale,
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

// ==============================================
// API - DASHBOARD
// ==============================================

// Métricas do dashboard
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const [salesToday, revenueToday, totalClients, totalProducts, lowStock] = await Promise.all([
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
    
    // Criar tabelas
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
        email VARCHAR(100),
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
        ('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'corporate')
      `);
      console.log('👥 Clientes de exemplo criados');
    }
    
    const productsExist = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(productsExist.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO products (code, name, category, unit_price, stock) VALUES
        ('PROD001', 'Arroz 5kg', 'Alimentos', 350.00, 100),
        ('PROD002', 'Azeite 1L', 'Alimentos', 850.00, 50),
        ('PROD003', 'Detergente', 'Limpeza', 45.00, 200),
        ('PROD004', 'Sabonete', 'Higiene', 25.00, 150)
      `);
      console.log('📦 Produtos de exemplo criados');
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
╔═══════════════════════════════════════════════════════╗
║          BIZZ FLOW CRM v2.0 - POSTGRESQL             ║
╠═══════════════════════════════════════════════════════╣
║ Status:        ✅ ONLINE                             ║
║ Ambiente:      ${process.env.NODE_ENV || 'development'}                    ║
║ Porta:         ${PORT}                              ║
║ URL:           http://localhost:${PORT}             ║
║ Banco:         PostgreSQL (Render)                   ║
║                                                       ║
║ 🔧 ENDPOINTS:                                        ║
║   • /health           → Health check                 ║
║   • /api/auth/login   → Login (admin/admin123)      ║
║   • /api/clients      → Gerenciar clientes          ║
║   • /api/products     → Gerenciar produtos          ║
║   • /api/sales        → Realizar vendas             ║
║   • /api/dashboard    → Métricas                    ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar
startServer();
