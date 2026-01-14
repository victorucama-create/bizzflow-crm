const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar rotas
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// ========== CORREÇÃO CRÍTICA: CONFIGURAÇÃO DO HELMET ==========
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",      // Permite onclick, onsubmit, etc
          "'unsafe-eval'",        // Permite eval() do Chart.js
          "https://bizzflow-crm.onrender.com",
          "https://cdn.jsdelivr.net"  // Para Chart.js se ainda usar CDN
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",      // Permite style=""
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net"
        ],
        imgSrc: [
          "'self'",
          "data:",                // Imagens base64
          "blob:",                // Para uploads
          "https:",               // Todas imagens HTTPS
          "http:"                 // Apenas para desenvolvimento
        ],
        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net"
        ],
        connectSrc: [
          "'self'",
          "https://bizzflow-crm.onrender.com",
          "wss://bizzflow-crm.onrender.com",  // WebSockets se necessário
          "https://dpg-d5j6bgje5dus739ld7ag-a.oregon-postgres.render.com"  // Banco de dados
        ],
        frameSrc: ["'self'"],     // Permite iframes do mesmo domínio
        frameAncestors: ["'self'"], // Permite ser iframeado
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []  // Desativa redirecionamento HTTPS forçado
      },
    },
    // Configurações adicionais do Helmet
    crossOriginEmbedderPolicy: false,  // Importante para Chart.js
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);

// CORS config
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'https://bizzflow-crm.onrender.com',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware para headers personalizados (backup)
app.use((req, res, next) => {
  // Headers adicionais de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache control para APIs
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
});

// Limitar requisições (ajustado para desenvolvimento)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Mais limite em dev
  message: {
    success: false,
    message: 'Muitas requisições deste IP. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== ROTA DE SAÚDE MELHORADA ==========
app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'BizzFlow CRM API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========== KEEP-ALIVE PARA RENDER.COM ==========
app.get('/keep-alive', (req, res) => {
  console.log('Keep-alive ping recebido:', new Date().toISOString());
  res.json({ 
    success: true,
    message: 'Servidor ativo',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========== SERVIR ARQUIVOS ESTÁTICOS (FRONTEND) ==========
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ========== ROTA PARA DOWNLOADS/EXPORTAÇÕES ==========
app.get('/api/export/clients/excel', require('./controllers/exportController').exportClientsExcel);
app.get('/api/export/sales/pdf/:id', require('./controllers/exportController').exportSalePDF);

// ========== ROTAS DA API ==========
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ========== ROTA PARA SPA (SINGLE PAGE APPLICATION) ==========
// Esta rota DEVE ser a última antes do 404
app.get('*', (req, res, next) => {
  // Ignorar se for API ou arquivo estático
  if (req.path.startsWith('/api') || 
      req.path.includes('.') || 
      req.path.startsWith('/health') ||
      req.path.startsWith('/keep-alive')) {
    return next();
  }
  
  // Servir index.html para todas outras rotas (SPA)
  res.sendFile('index.html', { root: 'public' });
});

// ========== ROTA 404 PARA APIs ==========
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint da API não encontrado.',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      '/api/auth/login',
      '/api/clients',
      '/api/products',
      '/api/sales',
      '/api/dashboard'
    ]
  });
});

// ========== ERROR HANDLER GLOBAL ==========
app.use((err, req, res, next) => {
  console.error('🚨 Erro global:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });
  
  // Verificar se é erro de CSP
  if (err.message && err.message.includes('Content Security Policy')) {
    console.warn('⚠️ Erro de CSP detectado, ajustando políticas...');
  }
  
  const statusCode = err.status || 500;
  const response = {
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor.' 
      : err.message,
    path: req.path
  };
  
  // Adicionar stack apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
    response.details = err.details || err.errors;
  }
  
  res.status(statusCode).json(response);
});

module.exports = app;
