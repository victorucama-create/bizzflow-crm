const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { authValidations, validateRequest } = require('../middleware/validation');

// Login
router.post('/login', authValidations, validateRequest, authController.login);

// Registrar (apenas admin)
router.post('/register', authMiddleware, adminOnly, authValidations, validateRequest, authController.register);

// Perfil do usuário
router.get('/profile', authMiddleware, authController.getProfile);

// Alterar senha
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
