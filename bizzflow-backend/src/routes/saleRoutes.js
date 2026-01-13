const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authMiddleware, sellerOrAdmin } = require('../middleware/auth');
const { saleValidations, filterValidations, validateRequest } = require('../middleware/validation');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de vendas
router.post('/', sellerOrAdmin, saleValidations, validateRequest, saleController.create);
router.get('/', sellerOrAdmin, filterValidations, validateRequest, saleController.list);
router.get('/stats', sellerOrAdmin, saleController.getStats);
router.get('/:id', sellerOrAdmin, saleController.getById);
router.delete('/:id', sellerOrAdmin, saleController.delete);

module.exports = router;
