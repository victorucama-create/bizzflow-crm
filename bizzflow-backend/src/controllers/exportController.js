const excelGenerator = require('../utils/excelGenerator');
const pdfGenerator = require('../utils/pdfGenerator');
const Client = require('../models/Client');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const { query } = require('../config/database');

const exportController = {
  // Exportar clientes para Excel
  async exportClientsExcel(req, res) {
    try {
      const { filters = {} } = req.query;
      const clientsResult = await Client.findAll(filters, 10000, 0);
      
      const excelBuffer = excelGenerator.exportClients(clientsResult.rows);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=clientes_bizzflow.xlsx');
      
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Export clients error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar clientes.'
      });
    }
  },

  // Exportar produtos para Excel
  async exportProductsExcel(req, res) {
    try {
      const { filters = {} } = req.query;
      const productsResult = await Product.findAll(filters, 10000, 0);
      
      const excelBuffer = excelGenerator.exportProducts(productsResult.rows);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=produtos_bizzflow.xlsx');
      
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Export products error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar produtos.'
      });
    }
  },

  // Exportar vendas para Excel
  async exportSalesExcel(req, res) {
    try {
      const { filters = {} } = req.query;
      const salesResult = await Sale.findAll(filters, 10000, 0);
      
      const excelBuffer = excelGenerator.exportSales(salesResult.rows);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=vendas_bizzflow_${Date.now()}.xlsx`);
      
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Export sales error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar vendas.'
      });
    }
  },

  // Exportar recibo de venda para PDF
  async exportSalePDF(req, res) {
    try {
      const { id } = req.params;
      
      // Buscar venda com itens
      const sale = await Sale.findById(id);
      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Venda não encontrada.'
        });
      }
      
      // Buscar itens da venda
      const items = await SaleItem.findBySaleId(id);
      
      // Gerar PDF
      const pdfBuffer = await pdfGenerator.generateReceipt(sale, items);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=recibo_${sale.sale_number}.pdf`);
      
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('Export sale PDF error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar recibo.'
      });
    }
  },

  // Exportar relatório de vendas por período
  async exportSalesReport(req, res) {
    try {
      const { start_date, end_date, format = 'excel' } = req.query;
      
      // Buscar vendas no período
      const salesResult = await Sale.findAll({ start_date, end_date }, 10000, 0);
      
      if (format === 'pdf') {
        // Para PDF, criar um relatório formatado
        // (simplificado - em produção use uma biblioteca como pdfkit ou puppeteer)
        const reportData = {
          period: `${start_date} a ${end_date}`,
          total_sales: salesResult.rowCount,
          total_revenue: salesResult.rows.reduce((sum, sale) => sum + parseFloat(sale.final_amount), 0),
          sales: salesResult.rows
        };
        
        // Aqui você implementaria a geração de PDF do relatório
        res.json({
          success: true,
          message: 'Relatório PDF em desenvolvimento',
          data: reportData
        });
        
      } else {
        // Excel
        const excelBuffer = excelGenerator.exportSales(salesResult.rows);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_vendas_${start_date}_a_${end_date}.xlsx`);
        
        res.send(excelBuffer);
      }
      
    } catch (error) {
      console.error('Export sales report error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar relatório.'
      });
    }
  },

  // Exportar relatório de estoque
  async exportInventoryReport(req, res) {
    try {
      const { low_stock_only } = req.query;
      
      let filters = {};
      if (low_stock_only === 'true') {
        filters.low_stock = true;
      }
      
      const productsResult = await Product.findAll(filters, 10000, 0);
      
      // Adicionar cálculo de valor do estoque
      const productsWithValue = productsResult.rows.map(product => ({
        ...product,
        inventory_value: product.stock * product.unit_price,
        status: product.stock <= product.min_stock ? 'Baixo Estoque' : 'Normal'
      }));
      
      const excelBuffer = excelGenerator.exportProducts(productsWithValue);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_estoque.xlsx');
      
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Export inventory error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar relatório de estoque.'
      });
    }
  },

  // Backup completo do banco de dados
  async exportBackup(req, res) {
    try {
      // Exportar tudo
      const [clients, products, sales, saleItems] = await Promise.all([
        Client.findAll({}, 100000, 0),
        Product.findAll({}, 100000, 0),
        Sale.findAll({}, 100000, 0),
        query('SELECT * FROM sale_items LIMIT 100000')
      ]);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        clients: clients.rows,
        products: products.rows,
        sales: sales.rows,
        sale_items: saleItems.rows,
        metadata: {
          total_clients: clients.rowCount,
          total_products: products.rowCount,
          total_sales: sales.rowCount,
          total_items: saleItems.rowCount
        }
      };
      
      // Para JSON
      if (req.query.format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_bizzflow_${Date.now()}.json`);
        res.send(JSON.stringify(backupData, null, 2));
        
      } else {
        // Para Excel com múltiplas abas
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        // Aba de clientes
        const clientsSheet = workbook.addWorksheet('Clientes');
        clientsSheet.addRow(['ID', 'Nome', 'Email', 'Telefone', 'Categoria', 'Total Gasto', 'Última Compra']);
        clients.rows.forEach(client => {
          clientsSheet.addRow([
            client.id,
            client.name,
            client.email,
            client.phone,
            client.category,
            client.total_spent,
            client.last_purchase
          ]);
        });
        
        // Aba de produtos
        const productsSheet = workbook.addWorksheet('Produtos');
        productsSheet.addRow(['ID', 'Código', 'Nome', 'Categoria', 'Preço', 'Estoque', 'Estoque Mínimo']);
        products.rows.forEach(product => {
          productsSheet.addRow([
            product.id,
            product.code,
            product.name,
            product.category,
            product.unit_price,
            product.stock,
            product.min_stock
          ]);
        });
        
        // Gerar buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=backup_completo_bizzflow_${Date.now()}.xlsx`);
        res.send(buffer);
      }
      
    } catch (error) {
      console.error('Export backup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar backup.'
      });
    }
  }
};

module.exports = exportController;
