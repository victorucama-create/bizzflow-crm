const { body, param, query, validationResult } = require('express-validator');

// Validações comuns
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Validações para autenticação
const authValidations = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

// Validações para clientes
const clientValidations = [
  body('name').notEmpty().trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(/^\+?[\d\s\-\(\)]+$/),
  body('category').optional().isIn(['normal', 'VIP', 'corporate'])
];

// Validações para produtos
const productValidations = [
  body('code').notEmpty().trim(),
  body('name').notEmpty().trim().escape(),
  body('unit_price').isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('min_stock').optional().isInt({ min: 0 })
];

// Validações para vendas
const saleValidations = [
  body('client_id').optional().isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('discount').optional().isFloat({ min: 0 }),
  body('tax').optional().isFloat({ min: 0 }),
  body('payment_method').optional().isIn(['cash', 'card', 'transfer', 'check'])
];

// Validações para filtros
const filterValidations = [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().trim().escape(),
  query('category').optional().trim().escape()
];

module.exports = {
  validateRequest,
  authValidations,
  clientValidations,
  productValidations,
  saleValidations,
  filterValidations
};
