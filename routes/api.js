// routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../database');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.getUser(username, password);
    
    if (user) {
      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          username: user.username
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clientes
router.get('/clients', async (req, res) => {
  try {
    const clients = await db.getAllClients();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const client = req.body;
    const id = await db.createClient(client);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicione mais rotas conforme necessário...

module.exports = router;
