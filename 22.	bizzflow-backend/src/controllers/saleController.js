const Sale = require('../models/Sale');
const Product = require('../models/Product');

const saleController = {
  // Criar venda (venda rápida)
  async create(req, res) {
    try {
      const { items, ...saleData } = req.body;

      // Validar estoque dos produtos
      for (const item of items) {
        const product = await Product.findById(item.product_id);
        
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Produto ID ${item.product_id} não encontrado.`
          });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}`
          });
        }

        // Adicionar preço unitário se não fornecido
        if (!item.unit_price) {
          item.unit_price = product.unit_price;
        }
      }

      // Criar venda
      const sale = await Sale.create(saleData, items, req.userId);

      res.status(201).json({
        success: true,
        sale,
        message: 'Venda realizada com sucesso!'
      });

    } catch (error) {
      console.error('Create sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao realizar venda.'
      });
    }
  },

  // Listar vendas
  async list(req, res) {
    try {
      const { limit = 50, offset = 0, ...filters } = req.query;
      
      const result = await Sale.findAll(filters, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        sales: result.rows,
        total: result.rowCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('List sales error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar vendas.'
      });
    }
  },

  // Buscar venda por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const sale = await Sale.findById(id);

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada.'
        });
      }

      res.json({
        success: true,
        sale
      });

    } catch (error) {
      console.error('Get sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar venda.'
      });
    }
  },

  // Deletar venda
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se venda existe
      const existingSale = await Sale.findById(id);
      if (!existingSale) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada.'
        });
      }

      // Apenas admin pode deletar vendas antigas
      if (req.userRole !== 'admin') {
        const saleDate = new Date(existingSale.sale_date);
        const today = new Date();
        const diffDays = (today - saleDate) / (1000 * 60 * 60 * 24);
        
        if (diffDays > 1) {
          return res.status(403).json({
            success: false,
            message: 'Apenas administradores podem deletar vendas antigas.'
          });
        }
      }

      await Sale.delete(id);

      res.json({
        success: true,
        message: 'Venda deletada com sucesso!'
      });

    } catch (error) {
      console.error('Delete sale error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao deletar venda.'
      });
    }
  },

  // Estatísticas de vendas
  async getStats(req, res) {
    try {
      const { period = 'today' } = req.query;
      const stats = await Sale.getStats(period);
      
      res.json({
        success: true,
        stats,
        period
      });

    } catch (error) {
      console.error('Sales stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar estatísticas.'
      });
    }
  }
};

module.exports = saleController;
