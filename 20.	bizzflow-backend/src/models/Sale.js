const { query } = require('../config/database');

const Sale = {
  // Gerar número da venda
  generateSaleNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `V${year}${month}${day}${random}`;
  },

  // Criar venda
  async create(saleData, items, userId) {
    const {
      client_id, discount = 0, tax = 0,
      payment_method = 'cash', notes = ''
    } = saleData;

    // Calcular totais
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.unit_price * item.quantity;
    });

    const total_amount = subtotal;
    const final_amount = subtotal - discount + tax;
    const sale_number = this.generateSaleNumber();

    // Iniciar transação
    const client = await query('BEGIN');

    try {
      // Inserir venda
      const saleSql = `
        INSERT INTO sales 
        (sale_number, client_id, seller_id, total_amount, discount, tax, 
         final_amount, payment_method, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const saleResult = await query(saleSql, [
        sale_number, client_id, userId, total_amount, 
        discount, tax, final_amount, payment_method, notes
      ]);
      
      const sale = saleResult.rows[0];

      // Inserir itens e atualizar estoque
      for (const item of items) {
        // Inserir item
        const itemSql = `
          INSERT INTO sale_items 
          (sale_id, product_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `;
        
        await query(itemSql, [
          sale.id, item.product_id, item.quantity,
          item.unit_price, item.unit_price * item.quantity
        ]);

        // Atualizar estoque
        await query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      // Atualizar total gasto do cliente
      if (client_id) {
        await query(
          `UPDATE clients 
           SET total_spent = total_spent + $1, last_purchase = CURRENT_DATE
           WHERE id = $2`,
          [final_amount, client_id]
        );
      }

      await query('COMMIT');
      return sale;

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  // Buscar venda por ID
  async findById(id) {
    const saleSql = `
      SELECT s.*, c.name as client_name, u.name as seller_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE s.id = $1
    `;
    
    const itemsSql = `
      SELECT si.*, p.name as product_name, p.code as product_code
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `;

    const saleResult = await query(saleSql, [id]);
    const itemsResult = await query(itemsSql, [id]);

    if (saleResult.rows.length === 0) return null;

    return {
      ...saleResult.rows[0],
      items: itemsResult.rows
    };
  },

  // Listar vendas
  async findAll(filters = {}, limit = 50, offset = 0) {
    let sql = `
      SELECT s.*, c.name as client_name, u.name as seller_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtros por data
    if (filters.start_date && filters.end_date) {
      sql += ` AND s.sale_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(filters.start_date, filters.end_date);
      paramIndex += 2;
    } else if (filters.today) {
      sql += ` AND DATE(s.sale_date) = CURRENT_DATE`;
    } else if (filters.this_week) {
      sql += ` AND EXTRACT(WEEK FROM s.sale_date) = EXTRACT(WEEK FROM CURRENT_DATE)`;
    } else if (filters.this_month) {
      sql += ` AND EXTRACT(MONTH FROM s.sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)`;
    }

    if (filters.client_id) {
      sql += ` AND s.client_id = $${paramIndex}`;
      params.push(filters.client_id);
      paramIndex++;
    }

    if (filters.seller_id) {
      sql += ` AND s.seller_id = $${paramIndex}`;
      params.push(filters.seller_id);
      paramIndex++;
    }

    sql += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return await query(sql, params);
  },

  // Deletar venda
  async delete(id) {
    // Iniciar transação para reverter estoque
    await query('BEGIN');

    try {
      // Buscar itens para reverter estoque
      const itemsSql = 'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1';
      const itemsResult = await query(itemsSql, [id]);

      // Reverter estoque
      for (const item of itemsResult.rows) {
        await query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      // Deletar itens e venda
      await query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
      const result = await query('DELETE FROM sales WHERE id = $1 RETURNING *', [id]);

      await query('COMMIT');
      return result.rows[0];

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  // Estatísticas de vendas
  async getStats(period = 'today') {
    let dateFilter = '';
    
    switch (period) {
      case 'today':
        dateFilter = 'AND DATE(sale_date) = CURRENT_DATE';
        break;
      case 'week':
        dateFilter = 'AND EXTRACT(WEEK FROM sale_date) = EXTRACT(WEEK FROM CURRENT_DATE)';
        break;
      case 'month':
        dateFilter = 'AND EXTRACT(MONTH FROM sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)';
        break;
      case 'year':
        dateFilter = 'AND EXTRACT(YEAR FROM sale_date) = EXTRACT(YEAR FROM CURRENT_DATE)';
        break;
    }

    const sql = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_value,
        COUNT(DISTINCT client_id) as unique_clients,
        COALESCE(SUM(
          CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END
        ), 0) as cash_total,
        COALESCE(SUM(
          CASE WHEN payment_method = 'card' THEN final_amount ELSE 0 END
        ), 0) as card_total
      FROM sales
      WHERE status = 'completed'
      ${dateFilter}
    `;

    const result = await query(sql);
    return result.rows[0];
  }
};

module.exports = Sale;
