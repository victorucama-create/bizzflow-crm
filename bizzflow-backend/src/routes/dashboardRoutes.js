const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Métricas do dashboard
router.get('/metrics', dashboardController.getMainMetrics);
router.get('/sales-by-period', dashboardController.getSalesByPeriod);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/top-clients', dashboardController.getTopClients);
router.get('/category-metrics', dashboardController.getCategoryMetrics);

module.exports = router;
