const Product = require('../models/Product');

const productController = {
  // Criar produto
  async create(req, res) {
    try {
      const result = await Product.create(req.body);
      const product = result.rows[0];

      res.status(201).json({
        success: true,
        product,
        message: 'Produto criado com sucesso!'
      });

    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar produto.'
      });
    }
  },

  // Listar produtos
  async list(req, res) {
    try {
      const { limit = 100, offset = 0, ...filters } = req.query;
      
      const result = await Product.findAll(filters, parseInt(limit), parseInt(offset));
      
      res.json({
        success: true,
        products: result.rows,
        total: result.rowCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('List products error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar produtos.'
      });
    }
  },

  // Buscar produto por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado.'
        });
      }

      res.json({
        success: true,
        product
      });

    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar produto.'
      });
    }
  },

  // Buscar produto por código
  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const product = await Product.findByCode(code);

      res.json({
        success: true,
        product: product || null
      });

    } catch (error) {
      console.error('Get product by code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar produto.'
      });
    }
  },

  // Atualizar produto
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se produto existe
      const existingProduct = await Product.findById(id);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado.'
        });
      }

      const result = await Product.update(id, req.body);
      const product = result.rows[0];

      res.json({
        success: true,
        product,
        message: 'Produto atualizado com sucesso!'
      });

    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar produto.'
      });
    }
  },

  // Atualizar estoque
  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      const result = await Product.updateStock(id, parseInt(quantity));
      const product = result.rows[0];

      res.json({
        success: true,
        product,
        message: 'Estoque atualizado com sucesso!'
      });

    } catch (error) {
      console.error('Update stock error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar estoque.'
      });
    }
  },

  // Deletar produto
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar se produto existe
      const existingProduct = await Product.findById(id);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: 'Produto não encontrado.'
        });
      }

      await Product.delete(id);

      res.json({
        success: true,
        message: 'Produto deletado com sucesso!'
      });

    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao deletar produto.'
      });
    }
  },

  // Estatísticas de produtos
  async getStats(req, res) {
    try {
      const stats = await Product.getStats();
      
      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Product stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar estatísticas.'
      });
    }
  }
};

module.exports = productController;
