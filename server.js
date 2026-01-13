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

// Rate Limiting - Prevenir ataques de força bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requisições por IP
    message: {
        success: false,
        error: 'Muitas requisições deste IP. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
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

// Compression - Comprimir respostas
app.use(compression());

// CORS - Permitir requisições de diferentes origens
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? ['https://bizzflow-crm.onrender.com'] 
        : ['http://localhost:3000'],
    credentials: true
}));

// Logging
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Em produção, log apenas erros
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
// ROTAS PRINCIPAIS
// ======================

// Health Check para Render.com
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: NODE_ENV
    });
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de status do sistema
app.get('/api/status', limiter, (req, res) => {
    res.json({
        success: true,
        data: {
            app: 'Bizz Flow CRM',
            version: '2.0.0',
            environment: NODE_ENV,
            timestamp: new Date().toISOString(),
            features: {
                clients: true,
                products: true,
                sales: true,
                subscriptions: true,
                reports: true
            }
        }
    });
});

// ======================
// API DE DADOS (PARA FUTURO)
// ======================

// Rotas de autenticação (simuladas)
app.post('/api/login', limiter, (req, res) => {
    const { username, password } = req.body;
    
    // Credenciais de demonstração
    const validUsers = {
        'admin': { password: 'admin123', name: 'Administrador', role: 'Super Admin' },
        'manager': { password: 'manager123', name: 'Gestor', role: 'Gestor' },
        'seller': { password: 'seller123', name: 'Vendedor', role: 'Vendedor' }
    };

    if (validUsers[username] && validUsers[username].password === password) {
        res.json({
            success: true,
            user: {
                username,
                name: validUsers[username].name,
                role: validUsers[username].role,
                token: 'demo-token-' + Date.now()
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Credenciais inválidas'
        });
    }
});

// Backup dos dados do localStorage
app.post('/api/backup', limiter, (req, res) => {
    try {
        const { data, type } = req.body;
        
        // Criar pasta de backups se não existir
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Salvar backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${type}-${timestamp}.json`;
        const filepath = path.join(backupDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        res.json({
            success: true,
            message: 'Backup criado com sucesso',
            filename,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro no backup:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar backup'
        });
    }
});

// Restaurar backup
app.get('/api/backup/list', limiter, (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            return res.json({ success: true, backups: [] });
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const stats = fs.statSync(path.join(backupDir, file));
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json({
            success: true,
            backups: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao listar backups'
        });
    }
});

// ======================
// MIDDLEWARE DE ERRO
// ======================

// Rota não encontrada
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path
    });
});

// Manipulador de erros global
app.use((err, req, res, next) => {
    console.error('Erro:', err);

    // Log em arquivo em produção
    if (NODE_ENV === 'production') {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, 'errors.log');
        fs.appendFileSync(logFile, `${new Date().toISOString()} - ${err.stack}\n`);
    }

    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ======================
// INICIALIZAÇÃO
// ======================

// Criar diretórios necessários
const requiredDirs = ['backups', 'logs'];
requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║          BIZZ FLOW CRM v2.0              ║
╠══════════════════════════════════════════╣
║ Status:      ✅ Online                   ║
║ Ambiente:    ${NODE_ENV.padEnd(15)}     ║
║ Porta:       ${PORT.toString().padEnd(15)}     ║
║ URL:         http://localhost:${PORT}   ║
║                                            ║
║ Rotas disponíveis:                        ║
║ • /          - Interface principal        ║
║ • /health    - Health check               ║
║ • /api/status- Status do sistema          ║
║ • /api/login - Autenticação               ║
║ • /api/backup- Sistema de backup          ║
╚══════════════════════════════════════════╝
    `);
    
    // Log de ambiente
    console.log(`📁 Diretório raiz: ${__dirname}`);
    console.log(`📊 Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    // Avisos importantes
    if (NODE_ENV === 'production') {
        console.log('🔒 Ambiente de PRODUÇÃO - Segurança ativada');
    } else {
        console.log('🔧 Ambiente de DESENVOLVIMENTO - Debug ativado');
    }
});
