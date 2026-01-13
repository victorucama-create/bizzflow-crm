const User = require('../models/User');
const { generateToken } = require('../config/auth');

const authController = {
  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validar credenciais
      const user = await User.validateCredentials(email, password);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha incorretos.'
        });
      }

      // Atualizar último login
      await User.updateLastLogin(user.id);

      // Gerar token
      const token = generateToken(user.id, user.role);

      // Remover senha da resposta
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        token,
        user: userWithoutPassword,
        message: 'Login realizado com sucesso!'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao realizar login.'
      });
    }
  },

  // Registrar usuário (apenas admin)
  async register(req, res) {
    try {
      const { name, email, password, role } = req.body;

      // Verificar se email já existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email já registrado.'
        });
      }

      // Criar usuário
      const result = await User.create({ name, email, password, role });
      const newUser = result.rows[0];

      res.status(201).json({
        success: true,
        user: newUser,
        message: 'Usuário criado com sucesso!'
      });

    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar usuário.'
      });
    }
  },

  // Perfil do usuário logado
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado.'
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar perfil.'
      });
    }
  },

  // Alterar senha
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId;

      // Buscar usuário com senha
      const user = await User.findByEmail(req.user.email);
      
      // Verificar senha atual
      const isValid = await require('../config/auth').comparePassword(
        currentPassword, 
        user.password
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Senha atual incorreta.'
        });
      }

      // Hash da nova senha
      const hashedPassword = await require('../config/auth').hashPassword(newPassword);

      // Atualizar senha
      await require('../config/database').query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, userId]
      );

      res.json({
        success: true,
        message: 'Senha alterada com sucesso!'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao alterar senha.'
      });
    }
  }
};

module.exports = authController;
