const PDFDocument = require('pdfkit');

const pdfGenerator = {
  // Gerar recibo de venda
  generateReceipt(sale, items) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Cabeçalho
        doc.fontSize(20).text('BIZZFLOW CRM', { align: 'center' });
        doc.fontSize(12).text('Recibo de Venda', { align: 'center' });
        doc.moveDown();

        // Informações da venda
        doc.fontSize(10);
        doc.text(`Número: ${sale.sale_number}`);
        doc.text(`Data: ${new Date(sale.sale_date).toLocaleString()}`);
        doc.text(`Cliente: ${sale.client_name || 'Consumidor Final'}`);
        doc.text(`Vendedor: ${sale.seller_name}`);
        doc.moveDown();

        // Tabela de itens
        const tableTop = doc.y;
        const itemWidth = 350;
        const quantityWidth = 50;
        const priceWidth = 60;
        const totalWidth = 80;

        // Cabeçalho da tabela
        doc.text('Item', 50, tableTop);
        doc.text('Qtd', 50 + itemWidth, tableTop);
        doc.text('Preço', 50 + itemWidth + quantityWidth, tableTop);
        doc.text('Total', 50 + itemWidth + quantityWidth + priceWidth, tableTop);
        
        doc.moveTo(50, tableTop + 15)
          .lineTo(50 + itemWidth + quantityWidth + priceWidth + totalWidth, tableTop + 15)
          .stroke();
        
        let y = tableTop + 30;

        // Itens
        items.forEach((item, index) => {
          doc.text(item.product_name.substring(0, 40), 50, y);
          doc.text(item.quantity.toString(), 50 + itemWidth, y);
          doc.text(`${item.unit_price.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth, y);
          doc.text(`${item.total_price.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth + priceWidth, y);
          y += 20;
        });

        // Totais
        y += 20;
        doc.text('Subtotal:', 50 + itemWidth + quantityWidth, y);
        doc.text(`${sale.total_amount.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth + priceWidth, y);
        
        y += 20;
        doc.text('Desconto:', 50 + itemWidth + quantityWidth, y);
        doc.text(`${sale.discount.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth + priceWidth, y);
        
        y += 20;
        doc.text('Taxa:', 50 + itemWidth + quantityWidth, y);
        doc.text(`${sale.tax.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth + priceWidth, y);
        
        y += 20;
        doc.font('Helvetica-Bold');
        doc.text('TOTAL:', 50 + itemWidth + quantityWidth, y);
        doc.text(`${sale.final_amount.toFixed(2)} MZN`, 50 + itemWidth + quantityWidth + priceWidth, y);
        doc.font('Helvetica');

        // Método de pagamento
        y += 30;
        doc.text(`Método de Pagamento: ${sale.payment_method}`);
        
        // Rodapé
        doc.moveDown(2);
        doc.fontSize(8).text('Obrigado pela sua compra!', { align: 'center' });
        doc.text('BizzFlow CRM - Sistema de Gestão Comercial', { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
};

module.exports = pdfGenerator;
