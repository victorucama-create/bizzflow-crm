// ==============================================
// BIZZFLOW CRM v3.0 - SERVER COMPATÍVEL
// ==============================================
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
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
// MIDDLEWARE DE SEGURANÇA
// ==============================================
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: ['https://bizzflow-crm.onrender.com', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Headers personalizados
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ==============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==============================================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
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
      version: '3.0.0',
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

// Status do sistema
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'BizzFlow CRM',
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/*',
      clients: '/api/clients/*',
      products: '/api/products/*',
      sales: '/api/sales/*',
      dashboard: '/api/dashboard/*'
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
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // Criar admin automaticamente se não existir
      if (email === 'admin@bizzflow.com' && password === 'admin123') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query(
          `INSERT INTO users (name, email, password, role) 
           VALUES ('Administrador', 'admin@bizzflow.com', $1, 'admin')`,
          [hashedPassword]
        );
        
        // Buscar usuário recém-criado
        const newUser = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          ['admin@bizzflow.com']
        );
        
        const user = newUser.rows[0];
        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || 'secret-key',
          { expiresIn: '7d' }
        );
        
        const { password: _, ...userWithoutPassword } = user;
        
        return res.json({
          success: true,
          token,
          user: userWithoutPassword,
          message: 'Administrador criado e login realizado com sucesso!'
        });
      }
      
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

// Listar todos clientes
app.get('/api/clients', authenticateToken, async (req, res) => {
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

// Criar novo cliente
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
      [
        name,
        email || null,
        phone || null,
        address || null,
        city || null,
        province || null,
        category || 'normal'
      ]
    );
    
    res.status(201).json({
      success: true,
      client: result.rows[0],
      message: 'Cliente criado com sucesso!'
    });
    
  } catch (error) {
    console.error('Create client error:', error);
    
    // Erro de email duplicado
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
      [
        name,
        email || null,
        phone || null,
        address || null,
        city || null,
        province || null,
        category || 'normal',
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
      'SELECT id FROM clients WHERE id = $1',
      [id]
    );
    
    if (clientExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado.'
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
// API - PRODUTOS (CRUD COMPLETO)
// ==============================================

// Listar todos produtos
app.get('/api/products', authenticateToken, async (req, res) => {
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

// Criar novo produto
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { code, name, description, category, unit_price, stock, min_stock } = req.body;
    
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
      `INSERT INTO products (code, name, description, category, unit_price, stock, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        code.toUpperCase(),
        name,
        description || null,
        category || null,
        parseFloat(unit_price),
        stock ? parseInt(stock) : 0,
        min_stock ? parseInt(min_stock) : 10
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
    const { name, description, category, unit_price, stock, min_stock } = req.body;
    
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
           stock = $5, min_stock = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        name,
        description || null,
        category || null,
        parseFloat(unit_price),
        stock ? parseInt(stock) : 0,
        min_stock ? parseInt(min_stock) : 10,
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

// Deletar produto (soft delete)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se produto existe
    const productExists = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado.'
      });
    }
    
    // Soft delete
    await pool.query(
      'UPDATE products SET is_active = false WHERE id = $1',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Produto desativado com sucesso!'
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
// API - VENDAS (CRUD COMPLETO)
// ==============================================

// Listar todas vendas
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT s.*, c.name as client_name 
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       ORDER BY s.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
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
       WHERE si.sale_id = $1`,
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

// Criar nova venda
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
    
    await client.query('BEGIN');
    
    // Validar estoque e calcular total
    let subtotal = 0;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT unit_price, stock FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );
      
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Produto ID ${item.product_id} não encontrado.`
        });
      }
      
      const product = productResult.rows[0];
      
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
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
      
      // Inserir item da venda
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
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar venda.'
    });
  } finally {
    client.release();
  }
});

// Deletar venda
app.delete('/api/sales/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Verificar se venda existe
    const saleExists = await client.query(
      'SELECT id FROM sales WHERE id = $1',
      [id]
    );
    
    if (saleExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venda não encontrada.'
      });
    }
    
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

// ==============================================
// API - DASHBOARD
// ==============================================

// Métricas principais
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
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

// Vendas recentes
app.get('/api/dashboard/recent-sales', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, c.name as client_name 
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      ORDER BY s.created_at DESC 
      LIMIT 10
    `);
    
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

// Produtos mais vendidos
app.get('/api/dashboard/top-products', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.name, p.code, SUM(si.quantity) as total_quantity
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY p.id, p.name, p.code
      ORDER BY total_quantity DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      products: result.rows
    });
    
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos mais vendidos.'
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
      CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
    `);
    
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
║ Banco:         PostgreSQL                                    ║
║                                                               ║
║ 🔧 ENDPOINTS DISPONÍVEIS:                                    ║
║   • /health             → Health check                       ║
║   • /api/auth/login     → Login (admin/admin123)            ║
║   • /api/auth/profile   → Perfil do usuário                 ║
║   • /api/clients/*      → CRUD completo de clientes         ║
║   • /api/products/*     → CRUD completo de produtos         ║
║   • /api/sales/*        → CRUD completo de vendas           ║
║   • /api/dashboard/*    → Dashboard e métricas              ║
║                                                               ║
║ 📊 FUNCIONALIDADES:                                          ║
║   • Autenticação JWT    • CRUD completo                     ║
║   • Dashboard em tempo real • Transações seguras            ║
║   • Controle de estoque • Relatórios básicos                ║
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
