// ==============================================
// BIZZFLOW BACKEND - SERVER PRINCIPAL CORRIGIDO
// ==============================================
const app = require('./src/app');
const { pool } = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 10000;

// ========== CONFIGURAÇÃO DE KEEP-ALIVE AUTOMÁTICO ==========
// Para evitar que o Render.com coloque o servidor para dormir
const startKeepAlive = () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('🔋 Ativando keep-alive automático...');
    setInterval(async () => {
      try {
        const response = await fetch(`https://bizzflow-crm.onrender.com/health`);
        const data = await response.json();
        console.log(`✅ Keep-alive: ${new Date().toLocaleTimeString()} - Status: ${data.status}`);
      } catch (err) {
        console.log(`⚠️ Keep-alive falhou: ${err.message}`);
      }
    }, 5 * 60 * 1000); // A cada 5 minutos (mais frequente)
  }
};

// ========== VERIFICAÇÃO DE CONEXÃO COM BANCO ==========
const checkDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    console.log(`📊 Banco: ${client.database}`);
    console.log(`👤 Usuário: ${client.user}`);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    return false;
  }
};

// ========== INICIALIZAÇÃO DO SERVIDOR ==========
const startServer = async () => {
  try {
    // Verificar conexão com banco
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.log('🔄 Tentando reconexão em 10 segundos...');
      setTimeout(() => {
        process.exit(1);
      }, 10000);
      return;
    }
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Local: http://localhost:${PORT}`);
      console.log(`🌐 Produção: https://bizzflow-crm.onrender.com`);
      console.log(`📈 Health check: http://localhost:${PORT}/health`);
      console.log(`💤 Keep-alive: Ativo (5 minutos)`);
      
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
    
    // Tratar erros do servidor
    server.on('error', (error) => {
      console.error('💥 Erro no servidor:', error);
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Porta ${PORT} já em uso. Tentando porta ${parseInt(PORT) + 1}`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// ========== TRATAMENTO DE ERROS GLOBAIS ==========
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

// ========== LOG DE INICIALIZAÇÃO ==========
console.log('='.repeat(50));
console.log('🚀 INICIANDO BIZZFLOW CRM BACKEND');
console.log('='.repeat(50));
console.log(`🕐 ${new Date().toLocaleString()}`);
console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log(`🗄️  Database URL: ${process.env.DATABASE_URL ? '✓ Configurada' : '✗ Não configurada'}`);
console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ Configurada' : '✗ Usando padrão'}`);
console.log(`🚪 Porta: ${PORT}`);
console.log('='.repeat(50));

// Iniciar servidor
startServer();
