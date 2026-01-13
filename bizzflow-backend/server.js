const app = require('./src/app');
const { pool } = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Verificar conexão com banco de dados
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Conectado ao PostgreSQL com sucesso!');
  release();
  
  // Iniciar servidor
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
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
  console.error('💥 Erro não capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Promise rejeitada não tratada:', reason);
});
