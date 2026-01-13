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

// ======================
// BLOQUEIO DE REQUISIÇÕES EXTERNAS
// ======================

// Middleware para bloquear requisições externas indesejadas
app.use((req, res, next) => {
    const blockedDomains = [
        'gravatar.com',
        'gravatar.githubusercontent.com',
        'en.gravatar.com',
        'www.gravatar.com',
        'secure.gravatar.com'
    ];
    
    const referer = req.get('referer') || '';
    const host = req.get('host') || '';
    
    // Bloquear requisições para Gravatar e outros serviços externos
    if (req.url.includes('avatar') || blockedDomains.some(domain => req.url.includes(domain))) {
        console.log(`🚫 Bloqueada requisição externa: ${req.method} ${req.url} | Referer: ${referer}`);
        
        // Retornar avatar local em vez de 404
        if (req.url.includes('avatar')) {
            return res.redirect(`/api/avatar/default?s=20`);
        }
        
        return res.status(404).json({
            success: false,
            error: 'Recurso externo bloqueado por segurança',
            message: 'Este serviço está configurado para usar apenas recursos locais'
        });
    }
    
    next();
});

// ======================
// SISTEMA DE AVATARES LOCAL
// ======================

// Gerador de avatares SVG
app.get('/api/avatar/:userId', (req, res) => {
    try {
        const userId = req.params.userId || 'default';
        const size = parseInt(req.query.s) || 100;
        const text = req.query.text || userId.charAt(0).toUpperCase();
        
        // Paleta de cores do Bizz Flow
        const colorPalette = [
            '#1a5f7a', // Bizz Flow primary
            '#2a9d8f', // Bizz Flow secondary
            '#e9c46a', // Bizz Flow accent
            '#f4a261', // Bizz Flow warning
            '#e76f51', // Bizz Flow danger
            '#264653', // Bizz Flow dark
            '#2a9d8f', // Bizz Flow success
        ];
        
        // Gerar cor baseada no userId
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % colorPalette.length;
        const color = colorPalette[colorIndex];
        
        // Criar SVG do avatar
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color}99;stop-opacity:1" />
        </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="45" fill="url(#gradient)" stroke="#ffffff" stroke-width="2"/>
    <text x="50" y="58" text-anchor="middle" fill="#ffffff" font-size="40" font-family="Arial, sans-serif" font-weight="bold">
        ${text}
    </text>
</svg>`;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache de 7 dias
        res.send(svg);
        
    } catch (error) {
        console.error('Erro ao gerar avatar:', error);
        res.status(500).send('Erro ao gerar avatar');
    }
});

// Avatar padrão para usuários sem avatar
app.get('/avatar/default', (req, res) => {
    const size = parseInt(req.query.s) || 100;
    
    const defaultAvatar = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="#1a5f7a"/>
    <path d="M50,30 A20,20 0 1,1 50,70 A20,20 0 1,1 50,30" fill="#ffffff"/>
    <circle cx="50" cy="40" r="8" fill="#1a5f7a"/>
    <path d="M40,65 Q50,75 60,65" stroke="#ffffff" stroke-width="3" fill="none"/>
</svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(defaultAvatar);
});

// ======================
// SERVIR ARQUIVOS ESTÁTICOS
// ======================

// Servir arquivos estáticos com cache inteligente
app.use(express.static(path.join(__dirname), {
    maxAge: NODE_ENV === 'production' ? '1y' : '0',
    setHeaders: (res, filepath) => {
        const ext = path.extname(filepath);
        
        // Configurações de cache por tipo de arquivo
        if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (['.css', '.js', '.svg', '.png', '.jpg'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 ano
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

// Health Check - Otimizado para Render.com
app.get('/health', async (req, res) => {
    try {
        // Testar conexão com banco de forma não-bloqueante
        const dbCheck = new Promise((resolve) => {
            setTimeout(() => resolve({ status: 'timeout', message: 'Database check timeout' }), 2000);
            
            req.db.getStats()
                .then(stats => resolve({ status: 'connected', stats }))
                .catch(err => resolve({ status: 'error', error: err.message }));
        });
        
        const dbResult = await dbCheck;
        
        const healthData = {
            status: dbResult.status === 'connected' ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
            version: '2.0.0',
            database: dbResult.status,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
            },
            ...(dbResult.stats && { stats: dbResult.stats })
        };
        
        res.status(dbResult.status === 'connected' ? 200 : 503).json(healthData);
        
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Status do sistema (lightweight)
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
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Rota principal - sempre por último
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
        timestamp: new Date().toISOString(),
        suggestion: 'Verifique a documentação da API em /api/status'
    });
});

// Manipulador de erros global
app.use((err, req, res, next) => {
    console.error('Erro:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    // Log em arquivo
    if (NODE_ENV === 'production') {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, 'errors.log');
        const logEntry = `${new Date().toISOString()} - ${req.method} ${req.path} - ${err.message}\nStack: ${err.stack}\n\n`;
        
        fs.appendFileSync(logFile, logEntry, 'utf8');
    }

    const errorResponse = {
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
        timestamp: new Date().toISOString(),
        requestId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
    
    // Adicionar stack apenas em desenvolvimento
    if (NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }
    
    res.status(err.status || 500).json(errorResponse);
});

// ======================
// INICIALIZAÇÃO E CONFIGURAÇÃO
// ======================

// Criar diretórios necessários
function ensureDirectories() {
    const requiredDirs = [
        'data',          // Banco de dados SQLite
        'backups',       // Backups do sistema
        'logs',          // Logs de aplicação
        'uploads',       // Para futuros uploads
        'temp'           // Arquivos temporários
    ];
    
    requiredDirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Criado diretório: ${dir}`);
        }
    });
}

// Configurar tratamento de shutdown
function setupShutdownHandlers() {
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
    
    shutdownSignals.forEach(signal => {
        process.on(signal, async () => {
            console.log(`\n${signal} recebido. Encerrando servidor...`);
            
            try {
                // Fechar conexões de banco
                await db.close();
                console.log('✅ Conexões de banco fechadas');
                
                // Salvar logs finais
                const logger = require('./utils/logger');
                logger.info('Servidor encerrado', { signal, timestamp: new Date().toISOString() });
                
            } catch (error) {
                console.error('Erro durante shutdown:', error);
            } finally {
                process.exit(0);
            }
        });
    });
}

// Iniciar servidor
async function startServer() {
    try {
        // Garantir diretórios
        ensureDirectories();
        
        // Configurar handlers de shutdown
        setupShutdownHandlers();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║          BIZZ FLOW CRM v2.0 - SISTEMA COMPLETO       ║
╠═══════════════════════════════════════════════════════╣
║ Status:        ✅ ONLINE                             ║
║ Ambiente:      ${NODE_ENV.padEnd(20)}               ║
║ Porta:         ${PORT.toString().padEnd(20)}               ║
║ URL:           http://localhost:${PORT}             ║
║ Banco:         SQLite (data/bizzflow.db)             ║
║                                                       ║
║ 🔒 SEGURANÇA:                                        ║
║   • Rate Limiting      ✅ Ativo                      ║
║   • CORS               ✅ Configurado                ║
║   • Helmet.js          ✅ Headers de segurança       ║
║   • Gravatar           ✅ Bloqueado (usando local)   ║
║                                                       ║
║ 🚀 ENDPOINTS:                                        ║
║   • /                 → Interface principal          ║
║   • /health           → Health check                 ║
║   • /status           → Status do sistema            ║
║   • /api/*            → API RESTful                  ║
║   • /admin/api/*      → API administrativa           ║
║   • /api/avatar/*     → Avatares locais              ║
║                                                       ║
║ 📊 MONITORAMENTO:                                    ║
║   • Logs:            logs/*.log                      ║
║   • Backups:         backups/*.db                    ║
║   • Database:        data/bizzflow.db                ║
╚═══════════════════════════════════════════════════════╝
            `);
            
            // Informações do sistema
            console.log(`📁 Diretório raiz: ${__dirname}`);
            console.log(`📊 Memória inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
            console.log(`🔄 PID do processo: ${process.pid}`);
            
            // Mensagens por ambiente
            if (NODE_ENV === 'production') {
                console.log('🔒 AMBIENTE DE PRODUÇÃO');
                console.log('   • Segurança máxima ativada');
                console.log('   • Cache otimizado');
                console.log('   • Logs apenas de erro');
            } else {
                console.log('🔧 AMBIENTE DE DESENVOLVIMENTO');
                console.log('   • Debug ativado');
                console.log('   • Logs detalhados');
                console.log('   • Stack traces visíveis');
            }
            
            console.log('\n✨ Servidor pronto! Aguardando requisições...');
            console.log('👉 Pressione Ctrl+C para encerrar\n');
            
            // Verificação inicial do banco
            setTimeout(async () => {
                try {
                    const stats = await db.getStats();
                    console.log(`📊 Banco de dados: ${stats.totalClients || 0} clientes, ${stats.totalProducts || 0} produtos`);
                } catch (error) {
                    console.warn('⚠️  Aviso: Não foi possível conectar ao banco na inicialização');
                }
            }, 1000);
        });
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Iniciar a aplicação
startServer();

// Exportar app para testes
module.exports = app;
