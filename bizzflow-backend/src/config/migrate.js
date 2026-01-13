const { pool } = require('./database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, '../../database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar migração
    await client.query(sql);
    
    await client.query('COMMIT');
    console.log('✅ Migração do banco de dados concluída com sucesso!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
    
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
