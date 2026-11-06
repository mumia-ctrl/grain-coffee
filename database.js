const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'grain.db'));

// Создаем таблицы
db.serialize(() => {
  // Таблица товаров
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    image TEXT,
    description TEXT,
    active INTEGER DEFAULT 1
  )`);

  // Таблица заказов
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    customer_phone TEXT,
    items TEXT,
    total INTEGER,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Добавляем начальные товары
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)");
      stmt.run("Капучино на Эфиопии", 290, "images/cappuccino.jpg", "Нежный капучино с эфиопским зерном");
      stmt.run("Фильтр-кофе", 210, "images/filter.jpg", "Классический фильтр-кофе");
      stmt.run("Эспрессо-тоник", 350, "images/tonic.jpg", "Освежающий эспрессо с тоником");
      stmt.finalize();
    }
  });
});

module.exports = db;