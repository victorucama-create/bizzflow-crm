// routes/admin.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Middleware de autenticação admin (simplificado)
const isAdmin = (req, res, next) => {
  // Em produção, implementar JWT verification
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação necessário'
    });
  }
  
  // Verificação simplificada - em produção usar JWT
  const token = authHeader.split(' ')[1];
  if (token && token.startsWith('demo-token-')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Acesso não autorizado'
    });
  }
};

// Aplicar middleware de admin em todas as rotas
router.use(isAdmin);

// ========== DASHBOARD ADMIN ==========
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await req.db.getStats();
    const totalClients = await req.db.getAllClients();
    const totalProducts = await req.db.getAllProducts();
    const totalSales = await req.db.getAllSales(50, 0);
    
    res.json({
      success: true,
      data: {
        overview: {
          ...stats,
          totalClientsCount: totalClients.length,
          totalProductsCount: totalProducts.length,
          recentSalesCount: totalSales.length
        },
        recentActivity: {
          clients: totalClients.slice(0, 5),
          products: totalProducts.slice(0, 5),
          sales: totalSales.slice(0, 10)
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== GERENCIAMENTO DE USUÁRIOS ==========
router.get('/users', async (req, res) => {
  try {
    const users = await req.db.getAllUsers();
    
    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await req.db.getUserById(req.params.id);
    
    if (user) {
      res.json({
        success: true,
        data: user
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== BACKUP E RESTAURAÇÃO ==========
router.get('/backups', async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        data: [],
        message: 'Nenhum backup encontrado'
      });
    }
    
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);
    
    res.json({
      success: true,
      data: backups,
      total: backups.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/backups/create', async (req, res) => {
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

router.delete('/backups/:filename', async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'backups');
    const filePath = path.join(backupDir, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Backup não encontrado'
      });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: 'Backup removido com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== LOGS DO SISTEMA ==========
router.get('/logs', async (req, res) => {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    
    if (!fs.existsSync(logDir)) {
      return res.json({
        success: true,
        data: [],
        message: 'Nenhum log encontrado'
      });
    }
    
    const logs = fs.readdirSync(logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          lineCount: lines.length,
          lastLines: lines.slice(-50) // Últimas 50 linhas
        };
      })
      .sort((a, b) => b.created - a.created);
    
    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logs/:filename', async (req, res) => {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    const filePath = path.join(logDir, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de log não encontrado'
      });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    res.json({
      success: true,
      data: {
        filename: req.params.filename,
        totalLines: lines.length,
        lines: lines.slice(-500) // Últimas 500 linhas
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== RELATÓRIOS AVANÇADOS ==========
router.get('/reports/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sales = await req.db.getAllSales(1000, 0);
    
    // Filtrar por data se especificado
    if (startDate && endDate) {
      sales = sales.filter(s => {
        const saleDate = new Date(s.sale_date);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
      });
    }
    
    // Calcular estatísticas
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);
    const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
    
    // Agrupar por dia
    const salesByDay = {};
    sales.forEach(sale => {
      const day = sale.sale_date;
      if (!salesByDay[day]) {
        salesByDay[day] = { date: day, total: 0, count: 0 };
      }
      salesByDay[day].total += sale.total;
      salesByDay[day].count += 1;
    });
    
    // Top produtos
    const productSales = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.name]) {
          productSales[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productSales[item.name].quantity += item.quantity;
        productSales[item.name].revenue += item.price * item.quantity;
      });
    });
    
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalSales: sales.length,
          totalRevenue,
          totalItems,
          avgSale,
          period: { startDate, endDate }
        },
        dailySales: Object.values(salesByDay),
        topProducts,
        recentSales: sales.slice(0, 20)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/reports/clients', async (req, res) => {
  try {
    const clients = await req.db.getAllClients();
    const sales = await req.db.getAllSales(1000, 0);
    
    // Calcular estatísticas por cliente
    const clientStats = clients.map(client => {
      const clientSales = sales.filter(sale => sale.client_id === client.id);
      const totalSpent = clientSales.reduce((sum, sale) => sum + sale.total, 0);
      const lastPurchase = clientSales.length > 0 
        ? Math.max(...clientSales.map(s => new Date(s.sale_date)))
        : null;
      
      return {
        ...client,
        totalPurchases: clientSales.length,
        totalSpent,
        lastPurchase: lastPurchase ? new Date(lastPurchase).toISOString().split('T')[0] : null,
        avgPurchase: clientSales.length > 0 ? totalSpent / clientSales.length : 0
      };
    });
    
    // Top clientes por gasto
    const topClients = clientStats
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalClients: clients.length,
          activeClients: clientStats.filter(c => c.totalPurchases > 0).length,
          totalRevenue: clientStats.reduce((sum, c) => sum + c.totalSpent, 0),
          avgClientValue: clientStats.length > 0 
            ? clientStats.reduce((sum, c) => sum + c.totalSpent, 0) / clientStats.length 
            : 0
        },
        topClients,
        clientDistribution: {
          regular: clients.filter(c => c.type === 'regular').length,
          vip: clients.filter(c => c.type === 'vip').length,
          corporate: clients.filter(c => c.type === 'corporate').length,
          wholesale: clients.filter(c => c.type === 'wholesale').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== SISTEMA ==========
router.get('/system/info', async (req, res) => {
  try {
    const os = require('os');
    
    res.json({
      success: true,
      data: {
        server: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          uptime: os.uptime(),
          load: os.loadavg()
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          env: process.env.NODE_ENV
        },
        database: {
          path: path.join(__dirname, '..', 'data', 'bizzflow.db'),
          exists: fs.existsSync(path.join(__dirname, '..', 'data', 'bizzflow.db'))
        },
        directories: {
          data: fs.existsSync(path.join(__dirname, '..', 'data')),
          backups: fs.existsSync(path.join(__dirname, '..', 'backups')),
          logs: fs.existsSync(path.join(__dirname, '..', 'logs'))
        }
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
