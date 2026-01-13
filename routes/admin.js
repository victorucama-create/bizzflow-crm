// routes/admin.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Middleware de autenticação admin
const isAdmin = (req, res, next) => {
  // Implemente verificação de admin
  next();
};

router.get('/dashboard', isAdmin, (req, res) => {
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date(),
    users: 0, // Busque do banco
    sales: 0, // Busque do banco
    products: 0 // Busque do banco
  };
  
  res.json(stats);
});

router.get('/backups', isAdmin, (req, res) => {
  const backupDir = path.join(__dirname, '../backups');
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => ({
      name: f,
      size: fs.statSync(path.join(backupDir, f)).size,
      created: fs.statSync(path.join(backupDir, f)).birthtime
    }));
  
  res.json(backups);
});

module.exports = router;
