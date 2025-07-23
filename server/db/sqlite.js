const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Criar banco SQLite local
const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Criar tabelas se não existirem
db.serialize(() => {
  // Tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de produtos
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      marketplace TEXT NOT NULL,
      marketplace_product_id TEXT NOT NULL,
      sku TEXT,
      name TEXT,
      image_url TEXT,
      price REAL,
      inventory INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, marketplace, marketplace_product_id)
    )
  `);

  // Tabela de pedidos
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      marketplace TEXT NOT NULL,
      marketplace_order_id TEXT NOT NULL,
      order_date DATETIME NOT NULL,
      total_amount REAL,
      currency TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, marketplace, marketplace_order_id)
    )
  `);

  console.log('✅ Banco SQLite configurado com sucesso!');
});

// Funções helper para simular pool do PostgreSQL
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (sql.toLowerCase().startsWith('select')) {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows });
      });
    } else {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ 
          rows: [{ 
            id: this.lastID,
            ...params 
          }] 
        });
      });
    }
  });
};

module.exports = { query, db };