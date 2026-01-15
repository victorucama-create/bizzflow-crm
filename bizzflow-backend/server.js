// ==============================================
// BIZZFLOW BACKEND - SERVER PRINCIPAL
// ==============================================
const app = require('./src/app');
const { pool } = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 10000;

// ========== CONFIGURAÇÃO DE KEEP-ALIVE AUTOMÁTICO ==========
// Para evitar que o Render.com coloque o servidor para dormir
const startKeepAlive = () => {
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      fetch(`https://bizzflow-crm.onrender.com/keep-alive`)
        .then(res => console.log(`✅ Keep-alive: ${new Date().toLocaleTimeString()}`))
        .catch(err => console.log(`⚠️ Keep-alive falhou: ${err.message}`));
    }, 14 * 60 * 1000); // A cada 14 minutos (Render dorme após 15)
  }
};

// ========== ROTA KEEP-ALIVE ==========
app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    service: 'BizzFlow CRM'
  });
});

// ========== INICIALIZAÇÃO DO SERVIDOR ==========
// Testar conexão com banco de dados
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    
    // Tentar reconexão após 5 segundos
    setTimeout(() => {
      console.log('🔄 Tentando reconectar ao banco de dados...');
      process.exit(1);
    }, 5000);
    
    return;
  }
  
  console.log('✅ Conectado ao PostgreSQL com sucesso!');
  console.log(`📊 Banco: ${client.database}`);
  console.log(`👤 Usuário: ${client.user}`);
  release();
  
  // Iniciar servidor
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🌐 Produção: https://bizzflow-crm.onrender.com`);
    console.log(`📈 Health check: http://localhost:${PORT}/health`);
    console.log(`💤 Keep-alive: http://localhost:${PORT}/keep-alive`);
    
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

    // Forçar fechamento após 10 segundos
    setTimeout(() => {
      console.error('⏰ Timeout forçando desligamento...');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
});

// Tratar erros não capturados
process.on('uncaughtException', (err) => {
  console.error('💥 ERRO NÃO CAPTURADO:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  // Não sair imediatamente em produção
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Continuando execução após erro não capturado...');
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ PROMISE REJEITADA NÃO TRATADA:', {
    reason: reason?.message || reason,
    promise,
    timestamp: new Date().toISOString()
  });
});

// Log de inicialização
console.log('='.repeat(50));
console.log('🚀 INICIANDO BIZZFLOW CRM BACKEND');
console.log('='.repeat(50));
console.log(`🕐 ${new Date().toLocaleString()}`);
console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log(`🗄️  Database URL: ${process.env.DATABASE_URL ? '✓ Configurada' : '✗ Não configurada'}`);
console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ Configurada' : '✗ Usando padrão'}`);
console.log('='.repeat(50));
