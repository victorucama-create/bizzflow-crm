// routes/api.js
const express = require('express');
const router = express.Router();

// ========== AUTENTICAÇÃO ==========
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username e password são obrigatórios'
      });
    }

    const user = await req.db.getUser(username, password);
    
    if (user) {
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
            phone: user.phone
          },
          token: 'demo-token-' + Date.now(), // Em produção, usar JWT
          expiresIn: 3600
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro no servidor',
      message: error.message
    });
  }
});

// ========== CLIENTES ==========
router.get('/clients', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search } = req.query;
    
    let clients;
    if (search) {
      clients = await req.db.searchClients(search, parseInt(limit));
    } else {
      clients = await req.db.getAllClients(parseInt(limit), parseInt(offset));
    }
    
    res.json({
      success: true,
      data: clients,
      meta: {
        total: clients.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const client = await req.db.getClient(req.params.id);
    
    if (client) {
      res.json({
        success: true,
        data: client
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const client = req.body;
    
    if (!client.name || !client.phone) {
      return res.status(400).json({
        success: false,
        error: 'Nome e telefone são obrigatórios'
      });
    }
    
    const result = await req.db.createClient(client);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/clients/:id', async (req, res) => {
  try {
    const result = await req.db.updateClient(req.params.id, req.body);
    
    if (result.changes > 0) {
      res.json({
        success: true,
        message: 'Cliente atualizado com sucesso',
        changes: result.changes
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const result = await req.db.deleteClient(req.params.id);
    
    if (result.changes > 0) {
      res.json({
        success: true,
        message: 'Cliente removido com sucesso'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== PRODUTOS ==========
router.get('/products', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search, category } = req.query;
    
    let products = await req.db.getAllProducts(parseInt(limit), parseInt(offset));
    
    // Filtrar por categoria se especificado
    if (category) {
      products = products.filter(p => p.category === category);
    }
    
    // Buscar se especificado
    if (search) {
      products = await req.db.searchProducts(search, parseInt(limit));
    }
    
    res.json({
      success: true,
      data: products,
      meta: {
        total: products.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await req.db.getProduct(req.params.id);
    
    if (product) {
      res.json({
        success: true,
        data: product
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/products', async (req, res) => {
  try {
    const product = req.body;
    
    if (!product.code || !product.name || !product.price) {
      return res.status(400).json({
        success: false,
        error: 'Código, nome e preço são obrigatórios'
      });
    }
    
    const result = await req.db.createProduct(product);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Produto criado com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const result = await req.db.updateProduct(req.params.id, req.body);
    
    if (result.changes > 0) {
      res.json({
        success: true,
        message: 'Produto atualizado com sucesso',
        changes: result.changes
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const result = await req.db.deleteProduct(req.params.id);
    
    if (result.changes > 0) {
      res.json({
        success: true,
        message: 'Produto removido com sucesso'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== VENDAS ==========
router.get('/sales', async (req, res) => {
  try {
    const { limit = 50, offset = 0, date } = req.query;
    
    let sales = await req.db.getAllSales(parseInt(limit), parseInt(offset));
    
    // Filtrar por data se especificado
    if (date) {
      sales = sales.filter(s => s.sale_date === date);
    }
    
    res.json({
      success: true,
      data: sales,
      meta: {
        total: sales.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/sales/:id', async (req, res) => {
  try {
    const sale = await req.db.getSale(req.params.id);
    
    if (sale) {
      res.json({
        success: true,
        data: sale
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Venda não encontrada'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/sales', async (req, res) => {
  try {
    const sale = req.body;
    
    if (!sale.items || sale.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A venda deve conter pelo menos um item'
      });
    }
    
    // Gerar número de recibo
    const timestamp = Date.now();
    sale.receipt_no = `REC${timestamp}`;
    
    const result = await req.db.createSale(sale);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Venda registrada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== ESTATÍSTICAS ==========
router.get('/stats', async (req, res) => {
  try {
    const stats = await req.db.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== BACKUP ==========
router.post('/backup', async (req, res) => {
  try {
    const result = await req.db.backup();
    
    res.json({
      success: true,
      message: 'Backup criado com sucesso',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== STATUS DA API ==========
router.get('/status', async (req, res) => {
  try {
    const stats = await req.db.getStats();
    
    res.json({
      success: true,
      data: {
        api: 'Bizz Flow CRM API',
        version: '2.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: 'connected',
        stats: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
