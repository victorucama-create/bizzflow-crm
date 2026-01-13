const { verifyToken } = require('../config/auth');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Pegar token do header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acesso negado. Token não fornecido.' 
      });
    }

    // Verificar token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido ou expirado.' 
      });
    }

    // Buscar usuário
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não encontrado.' 
      });
    }

    // Adicionar usuário à requisição
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro na autenticação.' 
    });
  }
};

// Middleware para admin apenas
const adminOnly = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acesso restrito a administradores.' 
    });
  }
  next();
};

// Middleware para seller/admin
const sellerOrAdmin = (req, res, next) => {
  if (!['admin', 'seller'].includes(req.userRole)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Acesso restrito.' 
    });
  }
  next();
};

module.exports = { authMiddleware, adminOnly, sellerOrAdmin };
