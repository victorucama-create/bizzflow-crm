const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware, sellerOrAdmin } = require('../middleware/auth');
const { productValidations, filterValidations, validateRequest } = require('../middleware/validation');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de produtos
router.post('/', sellerOrAdmin, productValidations, validateRequest, productController.create);
router.get('/', sellerOrAdmin, filterValidations, validateRequest, productController.list);
router.get('/stats', sellerOrAdmin, productController.getStats);
router.get('/code/:code', sellerOrAdmin, productController.getByCode);
router.get('/:id', sellerOrAdmin, productController.getById);
router.put('/:id', sellerOrAdmin, productValidations, validateRequest, productController.update);
router.patch('/:id/stock', sellerOrAdmin, productController.updateStock);
router.delete('/:id', sellerOrAdmin, productController.delete);

module.exports = router;
