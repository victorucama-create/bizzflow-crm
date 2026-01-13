const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));

// Rota principal - serve o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para API básica (se precisar no futuro)
app.get('/api/data', (req, res) => {
    // Exemplo de endpoint de API
    res.json({
        status: 'success',
        message: 'Bizz Flow CRM API',
        version: '1.0.0'
    });
});

// Rotas para salvar/recuperar dados do localStorage no servidor
app.post('/api/save-data', (req, res) => {
    try {
        const { key, data } = req.body;
        // Aqui você pode salvar em um banco de dados real
        // Por enquanto, apenas retornamos sucesso
        console.log('Dados recebidos para salvar:', key);
        res.json({ success: true, message: 'Dados salvos com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para backup dos dados
app.get('/api/backup', (req, res) => {
    try {
        // Em uma implementação real, você buscaria de um banco de dados
        const backupData = {
            message: 'Backup endpoint - implemente a lógica de backup aqui',
            timestamp: new Date().toISOString()
        };
        res.json(backupData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check para Render.com
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Bizz Flow CRM rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});
