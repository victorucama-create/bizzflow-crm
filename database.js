// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'data', 'bizzflow.db'));
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de clientes
      this.db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        email TEXT,
        nif TEXT,
        address TEXT,
        type TEXT,
        notes TEXT,
        total_purchases REAL DEFAULT 0,
        last_purchase DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de produtos
      this.db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        category TEXT,
        price REAL,
        cost REAL,
        stock INTEGER,
        min_stock INTEGER,
        barcode TEXT,
        supplier TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Adicionar usuários padrão
      this.addDefaultUsers();
    });
  }

  addDefaultUsers() {
    const users = [
      { username: 'admin', password: 'admin123', name: 'Administrador', role: 'Super Admin' },
      { username: 'manager', password: 'manager123', name: 'Gestor', role: 'Gestor' },
      { username: 'seller', password: 'seller123', name: 'Vendedor', role: 'Vendedor' }
    ];

    users.forEach(user => {
      this.db.run(
        'INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        [user.username, user.password, user.name, user.role]
      );
    });
  }

  // Métodos para cada operação...
  async getUser(username, password) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Adicione mais métodos conforme necessário
}

module.exports = new Database();
