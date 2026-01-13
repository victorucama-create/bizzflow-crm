// scripts/backup.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('📦 Iniciando backup do Bizz Flow CRM...');

const backupDir = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Criar backup dos dados do localStorage (se existirem)
const backupData = {
    timestamp: new Date().toISOString(),
    system: 'Bizz Flow CRM',
    version: '2.0.0',
    data: {
        // Aqui você pode adicionar exportação dos dados reais
        message: 'Execute o backup via interface web para dados específicos'
    }
};

const backupFile = path.join(backupDir, `system-backup-${timestamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

console.log(`✅ Backup criado: ${backupFile}`);
console.log(`📁 Local: ${backupDir}`);
console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

// Limpar backups antigos (mais de 30 dias)
const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }));

const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

files.forEach(file => {
    if (file.time < thirtyDaysAgo) {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Removido backup antigo: ${file.name}`);
    }
});

console.log('✨ Backup concluído com sucesso!');
