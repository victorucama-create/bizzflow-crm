const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ======================
// CONFIGURAÇÕES DE SEGURANÇA
// ======================

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite por IP
    message: {
        success: false,
        error: 'Muitas requisições. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Apenas 10 tentativas de login por IP
    message: {
        success: false,
        error: 'Muitas tentativas de login. Tente novamente mais tarde.'
    }
});

// Helmet - Headers de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ======================
// MIDDLEWARE
// ======================

// Compression
app.use(compression());

// CORS
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? ['https://bizzflow-crm.onrender.com'] 
        : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));

// Logging
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        skip: (req, res) => res.statusCode < 400
    }));
}

// Parse JSON e URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname), {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// ======================
// BANCO DE DADOS
// ======================

const db = require('./database');

// Middleware para injetar db em todas as requisições
app.use((req, res, next) => {
    req.db = db;
    next();
});

// ======================
// ROTAS
// ======================

// Importar rotas
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Aplicar rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Usar rotas
app.use('/api', apiRoutes);
app.use('/admin/api', adminRoutes);

// ======================
// ROTAS PRINCIPAIS
// ======================

// Health Check
app.get('/health', async (req, res) => {
    try {
        // Testar conexão com banco
        const stats = await req.db.getStats();
        
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
            database: 'connected',
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            database: 'disconnected'
        });
    }
});

// Status do sistema
app.get('/status', async (req, res) => {
    try {
        const stats = await req.db.getStats();
        
        res.json({
            success: true,
            data: {
                app: 'Bizz Flow CRM',
                version: '2.0.0',
                environment: NODE_ENV,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                stats: stats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ======================
// MIDDLEWARE DE ERRO
// ======================

// Rota não encontrada
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Manipulador de erros global
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    
    // Log em arquivo
    if (NODE_ENV === 'production') {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, 'errors.log');
        fs.appendFileSync(logFile, `${new Date().toISOString()} - ${req.method} ${req.path} - ${err.stack}\n`);
    }

    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
        timestamp: new Date().toISOString(),
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ======================
// INICIALIZAÇÃO
// ======================

// Criar diretórios necessários
const requiredDirs = ['data', 'backups', 'logs'];
requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║          BIZZ FLOW CRM v2.0                  ║
║         Banco de Dados: SQLite               ║
╠══════════════════════════════════════════════╣
║ Status:      ✅ Online                       ║
║ Ambiente:    ${NODE_ENV.padEnd(15)}         ║
║ Porta:       ${PORT.toString().padEnd(15)}         ║
║ URL:         http://localhost:${PORT}       ║
║                                             ║
║ Rotas disponíveis:                          ║
║ • /               - Interface principal     ║
║ • /health        - Health check            ║
║ • /status        - Status do sistema       ║
║ • /api/*         - API principal           ║
║ • /admin/api/*   - API administrativa      ║
╚══════════════════════════════════════════════╝
    `);
    
    console.log(`📁 Diretório: ${__dirname}`);
    console.log(`📊 Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    if (NODE_ENV === 'production') {
        console.log('🔒 Ambiente de PRODUÇÃO - Segurança máxima');
    } else {
        console.log('🔧 Ambiente de DESENVOLVIMENTO - Debug ativado');
    }
    
    console.log('✨ Servidor pronto para receber requisições!');
});
