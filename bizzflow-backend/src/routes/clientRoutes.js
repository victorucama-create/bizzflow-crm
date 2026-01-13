const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authMiddleware, sellerOrAdmin } = require('../middleware/auth');
const { clientValidations, filterValidations, validateRequest } = require('../middleware/validation');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD de clientes
router.post('/', sellerOrAdmin, clientValidations, validateRequest, clientController.create);
router.get('/', sellerOrAdmin, filterValidations, validateRequest, clientController.list);
router.get('/stats', sellerOrAdmin, clientController.getStats);
router.get('/email/:email', sellerOrAdmin, clientController.findByEmail);
router.get('/:id', sellerOrAdmin, clientController.getById);
router.put('/:id', sellerOrAdmin, clientValidations, validateRequest, clientController.update);
router.delete('/:id', sellerOrAdmin, clientController.delete);

module.exports = router;
