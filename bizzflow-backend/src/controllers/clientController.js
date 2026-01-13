const Client = require('../models/Client');

const clientController = {
  // Criar cliente
  async create(req, res) {
    try {
      const result = await Client.create(req.body, req.userId);
      const client = result.rows[0];

      res.status(201).json({
        success: true,
        client,
        message: 'Cliente criado com sucesso!'
      });

    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar cliente.'
      });
    }
  },

  // Listar clientes
  async list(req, res) {
    try {
      const { limit = 100, offset = 0, ...filters } = req.query;
      
      const result = await Client.findAll(filters, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        clients: result.rows,
        total: result.rowCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('List clients error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar clientes.'
      });
    }
  },

  // Buscar cliente por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const client = await Client.findById(id);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado.'
        });
      }

      res.json({
        success: true,
        client
      });

    } catch (error) {
      console.error('Get client error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar cliente.'
      });
    }
  },

  // Atualizar cliente
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se cliente existe
      const existingClient = await Client.findById(id);
      if (!existingClient) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado.'
        });
      }

      const result = await Client.update(id, req.body);
      const client = result.rows[0];

      res.json({
        success: true,
        client,
        message: 'Cliente atualizado com sucesso!'
      });

    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar cliente.'
      });
    }
  },

  // Deletar cliente
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se cliente existe
      const existingClient = await Client.findById(id);
      if (!existingClient) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado.'
        });
      }

      await Client.delete(id);

      res.json({
        success: true,
        message: 'Cliente deletado com sucesso!'
      });

    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao deletar cliente.'
      });
    }
  },

  // Estatísticas de clientes
  async getStats(req, res) {
    try {
      const stats = await Client.getStats();
      
      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Client stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar estatísticas.'
      });
    }
  },

  // Buscar cliente por email
  async findByEmail(req, res) {
    try {
      const { email } = req.params;
      const client = await Client.findByEmail(email);

      res.json({
        success: true,
        client: client || null
      });

    } catch (error) {
      console.error('Find client by email error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar cliente.'
      });
    }
  }
};

module.exports = clientController;
