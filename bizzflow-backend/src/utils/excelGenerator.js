const XLSX = require('xlsx');

const excelGenerator = {
  // Exportar clientes para Excel
  exportClients(clients) {
    const worksheet = XLSX.utils.json_to_sheet(clients.map(client => ({
      'ID': client.id,
      'Nome': client.name,
      'Email': client.email,
      'Telefone': client.phone,
      'Categoria': client.category,
      'Cidade': client.city,
      'Província': client.province,
      'Total Gasto': client.total_spent,
      'Última Compra': client.last_purchase,
      'Data Cadastro': client.created_at
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },

  // Exportar produtos para Excel
  exportProducts(products) {
    const worksheet = XLSX.utils.json_to_sheet(products.map(product => ({
      'Código': product.code,
      'Nome': product.name,
      'Descrição': product.description,
      'Categoria': product.category,
      'Preço Unitário': product.unit_price,
      'Preço de Custo': product.cost_price,
      'Estoque': product.stock,
      'Estoque Mínimo': product.min_stock,
      'Fornecedor': product.supplier,
      'Data Cadastro': product.created_at
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },

  // Exportar vendas para Excel
  exportSales(sales) {
    const worksheet = XLSX.utils.json_to_sheet(sales.map(sale => ({
      'Número Venda': sale.sale_number,
      'Cliente': sale.client_name,
      'Vendedor': sale.seller_name,
      'Total': sale.total_amount,
      'Desconto': sale.discount,
      'Taxa': sale.tax,
      'Valor Final': sale.final_amount,
      'Método Pagamento': sale.payment_method,
      'Status': sale.status,
      'Data Venda': sale.sale_date
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
};

module.exports = excelGenerator;
