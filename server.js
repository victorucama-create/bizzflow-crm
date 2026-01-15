// ==============================================
// BIZZFLOW CRM FRONTEND SERVER v5.0
// Servidor completo para servir frontend React/SPA
// ==============================================
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://bizzflow-crm.onrender.com", "http://localhost:10000"]
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==============================================
// CONFIGURAÇÃO DO FRONTEND
// ==============================================
// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Arquivos específicos
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), { maxAge: '7d' }));
app.use('/js', express.static(path.join(__dirname, 'public/js'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(__dirname, 'public/css'), { maxAge: '7d' }));
app.use('/images', express.static(path.join(__dirname, 'public/images'), { maxAge: '30d' }));

// ==============================================
// ROTAS DE API PROXY (para desenvolvimento)
// ==============================================
// Configuração para ambiente de desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  
  // Proxy para API backend
  app.use('/api', createProxyMiddleware({
    target: process.env.BACKEND_URL || 'http://localhost:10000',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'
    },
    onError: (err, req, res) => {
      console.error('Proxy Error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Erro de conexão com o backend',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }));
}

// ==============================================
// ROTAS DO FRONTEND (SPA)
// ==============================================
// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Rotas da aplicação
const appRoutes = [
  '/dashboard',
  '/login',
  '/register',
  '/clients',
  '/clients/new',
  '/clients/:id',
  '/clients/:id/edit',
  '/products',
  '/products/new',
  '/products/:id',
  '/products/:id/edit',
  '/sales',
  '/sales/new',
  '/sales/:id',
  '/inventory',
  '/inventory/movements',
  '/inventory/alerts',
  '/reports',
  '/reports/sales',
  '/reports/products',
  '/reports/clients',
  '/reports/financial',
  '/suppliers',
  '/suppliers/new',
  '/suppliers/:id',
  '/suppliers/:id/edit',
  '/team',
  '/team/new',
  '/team/:id',
  '/team/:id/edit',
  '/orders',
  '/orders/new',
  '/orders/:id',
  '/settings',
  '/settings/general',
  '/settings/users',
  '/settings/backup',
  '/profile',
  '/help',
  '/about'
];

// Todas as rotas da SPA
appRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });
});

// ==============================================
// API DE CONFIGURAÇÃO DO FRONTEND
// ==============================================
// Configurações do frontend
app.get('/api/frontend/config', (req, res) => {
  res.json({
    success: true,
    config: {
      appName: 'BizzFlow CRM',
      version: '5.0.0',
      apiUrl: process.env.NODE_ENV === 'production' 
        ? 'https://bizzflow-crm.onrender.com/api'
        : 'http://localhost:10000/api',
      features: {
        inventory: true,
        reports: true,
        multiUser: true,
        backup: true,
        notifications: true,
        darkMode: true
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#7c3aed',
        backgroundColor: '#f8fafc',
        textColor: '#1e293b'
      },
      company: {
        name: 'Bizz Flow Lda',
        logo: '/logo.png',
        supportEmail: 'suporte@bizzflow.co.mz',
        phone: '+258 84 123 4567'
      }
    }
  });
});

// Health check específico do frontend
app.get('/api/frontend/health', (req, res) => {
  res.json({
    success: true,
    service: 'BizzFlow CRM Frontend',
    status: 'healthy',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota para testar conexão com backend
app.get('/api/frontend/test-backend', async (req, res) => {
  try {
    const backendUrl = process.env.NODE_ENV === 'production'
      ? 'https://bizzflow-crm.onrender.com'
      : 'http://localhost:10000';
    
    const response = await fetch(`${backendUrl}/health`);
    const data = await response.json();
    
    res.json({
      success: true,
      backend: {
        connected: true,
        status: data.status,
        service: data.service,
        database: data.database
      }
    });
  } catch (error) {
    res.json({
      success: false,
      backend: {
        connected: false,
        error: error.message
      }
    });
  }
});

// ==============================================
// API MOCK PARA DESENVOLVIMENTO
// ==============================================
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Iniciando modo de desenvolvimento com API mock...');
  
  // Mock data para desenvolvimento
  const mockData = {
    users: [
      {
        id: 1,
        name: 'Admin User',
        email: 'admin@bizzflow.com',
        role: 'admin',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z'
      }
    ],
    clients: [
      {
        id: 1,
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '+258841234567',
        address: 'Maputo',
        category: 'VIP',
        total_spent: 15000,
        last_purchase: '2024-01-15'
      }
    ],
    products: [
      {
        id: 1,
        code: 'PROD001',
        name: 'Arroz 5kg',
        category: 'Alimentos',
        unit_price: 350.00,
        stock: 100,
        min_stock: 20
      }
    ],
    sales: [
      {
        id: 1,
        sale_number: 'V202401150001',
        client_name: 'João Silva',
        final_amount: 3500.00,
        payment_method: 'cash',
        sale_date: '2024-01-15T10:30:00Z'
      }
    ]
  };

  // Mock API endpoints
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (email === 'admin@bizzflow.com' && password === 'admin123') {
      res.json({
        success: true,
        token: 'mock-jwt-token-12345',
        user: mockData.users[0],
        message: 'Login realizado com sucesso!'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }
  });

  app.get('/api/dashboard/stats', (req, res) => {
    res.json({
      success: true,
      stats: {
        sales_today: { count: 5, total: 12500 },
        total_clients: 10,
        low_stock_products: 2,
        monthly_revenue: 85000,
        total_products: 25,
        stock_value: 150000,
        avg_monthly_sale: 4250,
        last_7_days: [
          { date: '2024-01-09', sales_count: 3, revenue: 7500 },
          { date: '2024-01-10', sales_count: 4, revenue: 9200 },
          { date: '2024-01-11', sales_count: 5, revenue: 11500 },
          { date: '2024-01-12', sales_count: 6, revenue: 14200 },
          { date: '2024-01-13', sales_count: 3, revenue: 6800 },
          { date: '2024-01-14', sales_count: 4, revenue: 9500 },
          { date: '2024-01-15', sales_count: 5, revenue: 12500 }
        ],
        top_products: [
          { product_name: 'Arroz 5kg', quantity_sold: 150, revenue: 52500 },
          { product_name: 'Feijão 1kg', quantity_sold: 120, revenue: 14400 }
        ],
        top_clients: [
          { client_name: 'João Silva', total_spent: 45000 },
          { client_name: 'Maria Santos', total_spent: 38000 }
        ]
      }
    });
  });

  app.get('/api/clients', (req, res) => {
    res.json({
      success: true,
      clients: mockData.clients,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1
      }
    });
  });

  app.get('/api/products', (req, res) => {
    res.json({
      success: true,
      products: mockData.products,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1
      }
    });
  });

  app.get('/api/sales', (req, res) => {
    res.json({
      success: true,
      sales: mockData.sales,
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1
      }
    });
  });
}

// ==============================================
// SERVIÇOS DE ARQUIVOS ESTÁTICOS
// ==============================================
// Service Worker
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/service-worker.js'), {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/'
    }
  });
});

// Manifest
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/manifest.json'), {
    headers: {
      'Content-Type': 'application/manifest+json'
    }
  });
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/favicon.ico'));
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/robots.txt'));
});

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/sitemap.xml'));
});

// ==============================================
// MIDDLEWARE DE ERROS
// ==============================================
// 404 para arquivos estáticos
app.use('/public', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Arquivo não encontrado'
  });
});

// 404 para API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint API não encontrado'
  });
});

// 404 geral (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Frontend Server Error:', err);
  
  if (req.xhr || req.path.startsWith('/api')) {
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } else {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro - BizzFlow CRM</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
          }
          .error-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
            text-align: center;
          }
          h1 {
            color: #dc3545;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
          }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: background 0.3s;
          }
          .btn:hover {
            background: #1d4ed8;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>⚠️ Ocorreu um erro</h1>
          <p>Desculpe, ocorreu um erro inesperado. Por favor, tente novamente.</p>
          <a href="/" class="btn">Voltar para o Dashboard</a>
        </div>
      </body>
      </html>
    `);
  }
});

// ==============================================
// INICIALIZAÇÃO DO SERVIDOR
// ==============================================
async function startServer() {
  try {
    console.log('='.repeat(70));
    console.log('🚀 INICIANDO BIZZFLOW CRM FRONTEND');
    console.log('='.repeat(70));
    console.log(`🕐 ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Diretório: ${__dirname}`);
    console.log(`🚪 Porta: ${PORT}`);
    
    // Verificar estrutura de arquivos
    const requiredDirs = ['public', 'public/js', 'public/css', 'public/images'];
    const fs = require('fs');
    
    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        console.log(`📁 Criando diretório: ${dir}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    
    // Criar arquivos padrão se não existirem
    const defaultFiles = {
      'public/index.html': `
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BizzFlow CRM</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="/favicon.ico">
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
        }
        .app-container {
            text-align: center;
            background: white;
            padding: 50px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
        }
        .logo {
            font-size: 48px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }
        .loading {
            color: #666;
            margin: 30px 0;
            font-size: 18px;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 30px;
            text-align: left;
        }
        .feature {
            background: #f8fafc;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        .feature h3 {
            color: #334155;
            margin-bottom: 5px;
            font-size: 14px;
        }
        .feature p {
            color: #64748b;
            font-size: 12px;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="logo">BizzFlow CRM</div>
        <div class="spinner"></div>
        <div class="loading">Carregando aplicação...</div>
        
        <div class="features">
            <div class="feature">
                <h3>📊 Dashboard</h3>
                <p>Estatísticas em tempo real e insights do negócio</p>
            </div>
            <div class="feature">
                <h3>👥 Clientes</h3>
                <p>Gestão completa de clientes e histórico</p>
            </div>
            <div class="feature">
                <h3>📦 Produtos</h3>
                <p>Controle de inventário e stock</p>
            </div>
            <div class="feature">
                <h3>💰 Vendas</h3>
                <p>Registro de vendas e faturação</p>
            </div>
            <div class="feature">
                <h3>📈 Relatórios</h3>
                <p>Análise detalhada e exportação</p>
            </div>
            <div class="feature">
                <h3>⚙️ Configurações</h3>
                <p>Personalização do sistema</p>
            </div>
        </div>
    </div>

    <script>
        // Detectar se o backend está disponível
        async function checkBackend() {
            try {
                const response = await fetch('/api/frontend/health');
                if (response.ok) {
                    window.location.href = '/dashboard';
                }
            } catch (error) {
                console.log('Aguardando backend...');
                setTimeout(checkBackend, 2000);
            }
        }
        
        // Iniciar verificação
        setTimeout(checkBackend, 1000);
        
        // Configurar Service Worker se suportado
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('Service Worker registrado:', reg))
                .catch(err => console.log('Service Worker erro:', err));
        }
    </script>
</body>
</html>`,
      'public/css/style.css': `
/* Estilos principais do BizzFlow CRM */
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --secondary: #7c3aed;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --light: #f8fafc;
  --dark: #1e293b;
  --gray: #64748b;
  --gray-light: #e2e8f0;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--light);
  color: var(--dark);
  line-height: 1.6;
}

/* Layout principal */
.app {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: white;
  border-right: 1px solid var(--gray-light);
  padding: 20px 0;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.logo {
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--gray-light);
  margin-bottom: 20px;
}

.logo h1 {
  font-size: 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-menu {
  list-style: none;
}

.nav-menu li {
  margin: 5px 0;
}

.nav-menu a {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: var(--gray);
  text-decoration: none;
  transition: all 0.3s;
}

.nav-menu a:hover,
.nav-menu a.active {
  background: var(--light);
  color: var(--primary);
  border-right: 3px solid var(--primary);
}

.nav-menu i {
  margin-right: 10px;
  width: 20px;
  text-align: center;
}

/* Main content */
.main-content {
  flex: 1;
  margin-left: 250px;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--gray-light);
}

.header h2 {
  font-size: 24px;
  font-weight: 600;
}

/* Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border-top: 4px solid var(--primary);
}

.stat-card.success { border-color: var(--success); }
.stat-card.warning { border-color: var(--warning); }
.stat-card.danger { border-color: var(--danger); }

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin: 10px 0;
}

.stat-label {
  color: var(--gray);
  font-size: 14px;
}

/* Tables */
.table-container {
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.table-header {
  padding: 20px;
  border-bottom: 1px solid var(--gray-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--light);
}

th, td {
  padding: 15px;
  text-align: left;
  border-bottom: 1px solid var(--gray-light);
}

th {
  font-weight: 600;
  color: var(--dark);
}

tr:hover {
  background: var(--light);
}

/* Forms */
.form-container {
  background: white;
  padding: 30px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  max-width: 800px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--dark);
}

.form-control {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gray-light);
  border-radius: var(--radius);
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-success {
  background: var(--success);
  color: white;
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--gray-light);
  color: var(--dark);
}

.btn-outline:hover {
  background: var(--light);
}

.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
}

.btn i {
  margin-right: 8px;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  justify-content: center;
  align-items: center;
}

.modal.active {
  display: flex;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: var(--radius);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  margin-bottom: 20px;
}

/* Responsividade */
@media (max-width: 768px) {
  .sidebar {
    width: 70px;
  }
  
  .sidebar .logo h1,
  .sidebar .nav-menu span {
    display: none;
  }
  
  .main-content {
    margin-left: 70px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* Loading states */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Notifications */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  z-index: 1001;
  animation: slideIn 0.3s ease;
}

.notification.success {
  background: var(--success);
  color: white;
}

.notification.error {
  background: var(--danger);
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}`,
      'public/js/app.js': `
// Aplicação principal BizzFlow CRM
class BizzFlowApp {
  constructor() {
    this.config = {};
    this.user = null;
    this.token = localStorage.getItem('token');
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.checkAuth();
    this.loadCurrentPage();
  }

  async loadConfig() {
    try {
      const response = await fetch('/api/frontend/config');
      this.config = await response.json();
      console.log('Config loaded:', this.config);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  setupEventListeners() {
    // Navegação
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-nav]')) {
        e.preventDefault();
        const page = e.target.getAttribute('data-nav');
        this.navigateTo(page);
      }
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // Modal fechar
    document.addEventListener('click', (e) => {
      if (e.target.matches('.modal') || e.target.matches('[data-close]')) {
        this.closeModal();
      }
    });
  }

  checkAuth() {
    if (this.token) {
      this.validateToken();
    } else {
      this.redirectToLogin();
    }
  }

  async validateToken() {
    try {
      const response = await fetch('/api/auth/validate', {
        headers: { Authorization: \`Bearer \${this.token}\` }
      });
      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        this.updateUI();
      } else {
        this.redirectToLogin();
      }
    } catch (error) {
      console.error('Token validation error:', error);
      this.redirectToLogin();
    }
  }

  redirectToLogin() {
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('token', data.token);
        this.showNotification('Login realizado com sucesso!', 'success');
        setTimeout(() => window.location.href = '/dashboard', 1000);
      } else {
        this.showNotification(data.message, 'error');
      }
    } catch (error) {
      this.showNotification('Erro ao conectar com o servidor', 'error');
    }
  }

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  navigateTo(page) {
    window.location.href = page;
  }

  loadCurrentPage() {
    const path = window.location.pathname;
    this.loadPageContent(path);
  }

  async loadPageContent(path) {
    try {
      // Mostrar loading
      document.getElementById('content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      
      // Carregar conteúdo da página
      let content = '';
      
      switch (path) {
        case '/dashboard':
          content = await this.loadDashboard();
          break;
        case '/clients':
          content = await this.loadClients();
          break;
        case '/products':
          content = await this.loadProducts();
          break;
        case '/sales':
          content = await this.loadSales();
          break;
        default:
          content = this.loadDefaultPage();
      }
      
      document.getElementById('content').innerHTML = content;
      this.attachPageEvents();
    } catch (error) {
      console.error('Error loading page:', error);
      document.getElementById('content').innerHTML = '<div class="error">Erro ao carregar página</div>';
    }
  }

  async loadDashboard() {
    try {
      const response = await fetch('/api/dashboard/stats', {
        headers: { Authorization: \`Bearer \${this.token}\` }
      });
      const data = await response.json();
      
      if (data.success) {
        return this.renderDashboard(data.stats);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    
    return '<div>Dashboard não disponível</div>';
  }

  renderDashboard(stats) {
    return \`
      <div class="dashboard">
        <div class="header">
          <h2>Dashboard</h2>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="app.refreshDashboard()">
              <i>↻</i> Atualizar
            </button>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Vendas Hoje</div>
            <div class="stat-value">\${stats.sales_today.total.toLocaleString('pt-BR', { style: 'currency', currency: 'MZN' })}</div>
            <div class="stat-desc">\${stats.sales_today.count} vendas</div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-label">Clientes</div>
            <div class="stat-value">\${stats.total_clients}</div>
            <div class="stat-desc">Clientes ativos</div>
          </div>
          
          <div class="stat-card warning">
            <div class="stat-label">Produtos Baixo Stock</div>
            <div class="stat-value">\${stats.low_stock_products}</div>
            <div class="stat-desc">Precisam de reposição</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Receita Mensal</div>
            <div class="stat-value">\${stats.monthly_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'MZN' })}</div>
            <div class="stat-desc">Média: \${stats.avg_monthly_sale.toLocaleString('pt-BR', { style: 'currency', currency: 'MZN' })}</div>
          </div>
        </div>
        
        <div class="charts-section">
          <h3>Vendas dos Últimos 7 Dias</h3>
          <div id="sales-chart"></div>
        </div>
        
        <div class="tables-section">
          <div class="table-container">
            <div class="table-header">
              <h3>Produtos Mais Vendidos</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                \${stats.top_products.map(p => \`
                  <tr>
                    <td>\${p.product_name}</td>
                    <td>\${p.quantity_sold}</td>
                    <td>\${p.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'MZN' })}</td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    \`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = \`notification \${type}\`;
    notification.textContent = message;
    notification.style.cssText = \`
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      background: \${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      z-index: 1000;
      animation: slideIn 0.3s ease;
    \`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  updateUI() {
    // Atualizar nome do usuário
    const userElement = document.getElementById('user-name');
    if (userElement && this.user) {
      userElement.textContent = this.user.name;
    }
  }

  closeModal() {
    const modal = document.querySelector('.modal.active');
    if (modal) {
      modal.classList.remove('active');
    }
  }
}

// Inicializar aplicação
window.app = new BizzFlowApp();`,
      'public/service-worker.js': `
// Service Worker para BizzFlow CRM
const CACHE_NAME = 'bizzflow-crm-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/favicon.ico'
];

// Instalação
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Ativação
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
  // Ignorar requisições de API
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          // Não cachear respostas inválidas
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

// Mensagens
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});`,
      'public/manifest.json': `{
  "name": "BizzFlow CRM",
  "short_name": "BizzFlow",
  "description": "Sistema de Gestão Comercial Completo",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/images/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}`,
      'public/robots.txt': `User-agent: *
Allow: /

Sitemap: https://bizzflow-crm.onrender.com/sitemap.xml`,
      'public/sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bizzflow-crm.onrender.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://bizzflow-crm.onrender.com/dashboard</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://bizzflow-crm.onrender.com/clients</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://bizzflow-crm.onrender.com/products</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`
    };

    Object.entries(defaultFiles).forEach(([filePath, content]) => {
      const fullPath = path.join(__dirname, filePath);
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, content);
        console.log(`📄 Criado: ${filePath}`);
      }
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BIZZFLOW CRM FRONTEND - ONLINE                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ✅ STATUS:         FRONTEND ATIVO                                          ║
║ 📍 PORTA:          ${PORT.toString().padEnd(48)} ║
║ 🌍 AMBIENTE:       ${(process.env.NODE_ENV || 'development').padEnd(47)} ║
║ 🔗 URL:            http://localhost:${PORT.toString().padEnd(43)} ║
║ 📁 DIRETÓRIO:      ${__dirname.substring(0, 50).padEnd(48)} ║
║                                                                              ║
║ 📡 ENDPOINTS:                                                              ║
║   • GET  /                    Página inicial                               ║
║   • GET  /dashboard           Dashboard principal                          ║
║   • GET  /api/frontend/config Configurações do frontend                    ║
║   • GET  /api/frontend/health Health check do frontend                     ║
║   • GET  /*                   Todas as rotas SPA                           ║
║                                                                              ║
║ 🔧 DESENVOLVIMENTO:                                                        ║
║   • Modo: ${process.env.NODE_ENV === 'development' ? 'API Mock ativa' : 'Produção'.padEnd(45)} ║
║   • Backend: ${process.env.BACKEND_URL || 'http://localhost:10000'.padEnd(44)} ║
╚══════════════════════════════════════════════════════════════════════════════╝
      `);
      console.log(`🚀 Frontend pronto em: http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`🔧 API Config: http://localhost:${PORT}/api/frontend/config`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n🧪 Modo Desenvolvimento Ativo:');
        console.log('   • API Mock disponível em /api/*');
        console.log('   • Login: admin@bizzflow.com / admin123');
        console.log('   • Use Ctrl+C para parar');
      }
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor frontend:', error);
    process.exit(1);
  }
}

// ==============================================
// MANIPULAÇÃO DE SINAIS
// ==============================================
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor frontend...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor frontend...');
  process.exit(0);
});

// ==============================================
// INICIAR SERVIDOR FRONTEND
// ==============================================
startServer();
