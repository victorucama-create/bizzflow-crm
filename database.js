// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'bizzflow.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // Tabela de usuários
      this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT,
        email TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de clientes
      this.db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        email TEXT,
        nif TEXT,
        address TEXT,
        type TEXT DEFAULT 'regular',
        notes TEXT,
        total_purchases REAL DEFAULT 0,
        last_purchase DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de produtos
      this.db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        category TEXT DEFAULT 'Geral',
        price REAL,
        cost REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 10,
        barcode TEXT,
        supplier TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de vendas
      this.db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no TEXT UNIQUE,
        client_id INTEGER,
        client_name TEXT,
        items TEXT, -- JSON array de itens
        subtotal REAL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL,
        payment_method TEXT,
        amount_received REAL,
        change REAL DEFAULT 0,
        seller TEXT,
        sale_date DATE,
        sale_time TIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`);

      // Tabela de fornecedores
      this.db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        contact TEXT,
        email TEXT,
        products TEXT,
        rating REAL DEFAULT 0,
        last_delivery DATE,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de assinaturas
      this.db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        client_name TEXT,
        plan_name TEXT,
        start_date DATE,
        end_date DATE,
        next_payment DATE,
        price REAL,
        status TEXT DEFAULT 'trial',
        payment_method TEXT,
        trial_end DATE,
        auto_renew BOOLEAN DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`);

      // Adicionar usuários padrão
      this.addDefaultUsers();
    });
  }

  addDefaultUsers() {
    const users = [
      { username: 'admin', password: 'admin123', name: 'Administrador', role: 'Super Admin', email: 'admin@bizzflow.co.mz' },
      { username: 'manager', password: 'manager123', name: 'Gestor', role: 'Gestor', email: 'manager@bizzflow.co.mz' },
      { username: 'seller', password: 'seller123', name: 'Vendedor', role: 'Vendedor', email: 'seller@bizzflow.co.mz' }
    ];

    users.forEach(user => {
      this.db.run(
        `INSERT OR IGNORE INTO users (username, password, name, role, email) 
         VALUES (?, ?, ?, ?, ?)`,
        [user.username, user.password, user.name, user.role, user.email]
      );
    });
  }

  // ========== MÉTODOS DE USUÁRIO ==========
  async getUser(username, password) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, name, role, email, phone FROM users WHERE username = ? AND password = ? AND is_active = 1',
        [username, password],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, name, role, email, phone, created_at FROM users WHERE id = ? AND is_active = 1',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT id, username, name, role, email, phone, created_at FROM users WHERE is_active = 1 ORDER BY created_at DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // ========== MÉTODOS DE CLIENTE ==========
  async createClient(client) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO clients (name, phone, email, nif, address, type, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        client.name,
        client.phone,
        client.email || null,
        client.nif || null,
        client.address || null,
        client.type || 'regular',
        client.notes || null
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...client });
      });
    });
  }

  async getClient(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM clients WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllClients(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM clients ORDER BY created_at DESC LIMIT ? OFFSET ?';
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateClient(id, client) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE clients 
        SET name = ?, phone = ?, email = ?, nif = ?, address = ?, type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        client.name,
        client.phone,
        client.email || null,
        client.nif || null,
        client.address || null,
        client.type || 'regular',
        client.notes || null,
        id
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  async deleteClient(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  // ========== MÉTODOS DE PRODUTO ==========
  async createProduct(product) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO products (code, name, category, price, cost, stock, min_stock, barcode, supplier, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        product.code,
        product.name,
        product.category || 'Geral',
        product.price,
        product.cost || 0,
        product.stock || 0,
        product.min_stock || 10,
        product.barcode || null,
        product.supplier || null,
        product.description || null
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...product });
      });
    });
  }

  async getProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllProducts(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateProduct(id, product) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE products 
        SET name = ?, category = ?, price = ?, cost = ?, stock = ?, min_stock = ?, 
            barcode = ?, supplier = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        product.name,
        product.category || 'Geral',
        product.price,
        product.cost || 0,
        product.stock || 0,
        product.min_stock || 10,
        product.barcode || null,
        product.supplier || null,
        product.description || null,
        id
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  async deleteProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  // ========== MÉTODOS DE VENDA ==========
  async createSale(sale) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO sales (receipt_no, client_id, client_name, items, subtotal, discount, tax, total, 
                          payment_method, amount_received, change, seller, sale_date, sale_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        sale.receipt_no,
        sale.client_id || null,
        sale.client_name || 'Cliente Avulso',
        JSON.stringify(sale.items),
        sale.subtotal,
        sale.discount || 0,
        sale.tax || 0,
        sale.total,
        sale.payment_method,
        sale.amount_received,
        sale.change || 0,
        sale.seller,
        sale.sale_date || new Date().toISOString().split('T')[0],
        sale.sale_time || new Date().toTimeString().split(' ')[0],
        sale.notes || null
      ];
      
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...sale });
      });
    });
  }

  async getSale(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM sales WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else {
          if (row) {
            try {
              row.items = JSON.parse(row.items);
            } catch (e) {
              row.items = [];
            }
          }
          resolve(row);
        }
      });
    });
  }

  async getAllSales(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sales ORDER BY sale_date DESC, sale_time DESC LIMIT ? OFFSET ?';
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            try {
              row.items = JSON.parse(row.items);
            } catch (e) {
              row.items = [];
            }
          });
          resolve(rows);
        }
      });
    });
  }

  // ========== MÉTODOS DE BUSCA ==========
  async searchClients(query, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM clients 
        WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR nif LIKE ?
        ORDER BY name LIMIT ?
      `;
      const searchTerm = `%${query}%`;
      this.db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async searchProducts(query, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM products 
        WHERE (name LIKE ? OR code LIKE ? OR barcode LIKE ? OR category LIKE ?) 
        AND is_active = 1
        ORDER BY name LIMIT ?
      `;
      const searchTerm = `%${query}%`;
      this.db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // ========== ESTATÍSTICAS ==========
  async getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM clients) as totalClients,
          (SELECT COUNT(*) FROM products WHERE is_active = 1) as totalProducts,
          (SELECT SUM(stock * price) FROM products WHERE is_active = 1) as stockValue,
          (SELECT COUNT(*) FROM products WHERE stock <= min_stock AND is_active = 1) as lowStockProducts,
          (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = DATE('now')) as todaySales,
          (SELECT SUM(total) FROM sales WHERE DATE(sale_date) = DATE('now')) as todayRevenue,
          (SELECT COUNT(*) FROM users WHERE is_active = 1) as totalUsers
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  // ========== BACKUP E RESTAURAÇÃO ==========
  async backup() {
    return new Promise((resolve, reject) => {
      const backupPath = path.join(__dirname, 'backups', `backup-${Date.now()}.db`);
      
      this.db.serialize(() => {
        const backupDb = new sqlite3.Database(backupPath);
        
        this.db.backup(backupDb, {
          progress: (status) => {
            console.log(`Backup progress: ${status.totalPages}/${status.remainingPages}`);
          }
        }, (err) => {
          if (err) {
            reject(err);
          } else {
            backupDb.close();
            resolve({ path: backupPath, size: fs.statSync(backupPath).size });
          }
        });
      });
    });
  }

  // ========== TRANSAÇÕES ==========
  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        try {
          const result = callback(this);
          this.db.run('COMMIT');
          resolve(result);
        } catch (error) {
          this.db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  // ========== FECHAR CONEXÃO ==========
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Criar instância única
const database = new Database();

// Exportar métodos úteis
module.exports = {
  // Usuários
  getUser: (username, password) => database.getUser(username, password),
  getUserById: (id) => database.getUserById(id),
  getAllUsers: () => database.getAllUsers(),
  
  // Clientes
  createClient: (client) => database.createClient(client),
  getClient: (id) => database.getClient(id),
  getAllClients: (limit, offset) => database.getAllClients(limit, offset),
  updateClient: (id, client) => database.updateClient(id, client),
  deleteClient: (id) => database.deleteClient(id),
  searchClients: (query, limit) => database.searchClients(query, limit),
  
  // Produtos
  createProduct: (product) => database.createProduct(product),
  getProduct: (id) => database.getProduct(id),
  getAllProducts: (limit, offset) => database.getAllProducts(limit, offset),
  updateProduct: (id, product) => database.updateProduct(id, product),
  deleteProduct: (id) => database.deleteProduct(id),
  searchProducts: (query, limit) => database.searchProducts(query, limit),
  
  // Vendas
  createSale: (sale) => database.createSale(sale),
  getSale: (id) => database.getSale(id),
  getAllSales: (limit, offset) => database.getAllSales(limit, offset),
  
  // Estatísticas
  getStats: () => database.getStats(),
  
  // Backup
  backup: () => database.backup(),
  
  // Transações
  transaction: (callback) => database.transaction(callback),
  
  // Fechar
  close: () => database.close(),
  
  // Acesso direto ao db para operações customizadas
  db: database.db
};
