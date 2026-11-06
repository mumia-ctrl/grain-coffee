require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('public/images'));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/images/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ===== AUTH =====
// Вход в админку
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const isValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || password);
  
  if (isValid || password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Неверный пароль' });
  }
});

// Middleware для проверки токена
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Нет токена' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Неверный токен' });
    next();
  });
};

// ===== PRODUCTS API =====
// Получить все товары
app.get('/api/products', (req, res) => {
  const { active } = req.query;
  let query = active !== undefined 
    ? "SELECT * FROM products WHERE active = ?"
    : "SELECT * FROM products";
  
  db.all(query, active !== undefined ? [active] : [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Добавить товар
app.post('/api/products', authMiddleware, upload.single('image'), (req, res) => {
  const { name, price, description } = req.body;
  const image = req.file ? `images/${req.file.filename}` : null;
  
  db.run(
    "INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)",
    [name, price, image, description],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, price, image, description });
    }
  );
});

// Обновить товар
app.put('/api/products/:id', authMiddleware, upload.single('image'), (req, res) => {
  const { name, price, description, active } = req.body;
  const { id } = req.params;
  
  let query = "UPDATE products SET name = ?, price = ?, description = ?";
  let params = [name, price, description];
  
  if (req.file) {
    query += ", image = ?";
    params.push(`images/${req.file.filename}`);
  }
  
  if (active !== undefined) {
    query += ", active = ?";
    params.push(active);
  }
  
  query += " WHERE id = ?";
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Удалить товар
app.delete('/api/products/:id', authMiddleware, (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ===== ORDERS API =====
// Создать заказ
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, items, total } = req.body;
  
  db.run(
    "INSERT INTO orders (customer_name, customer_phone, items, total) VALUES (?, ?, ?, ?)",
    [customer_name, customer_phone, JSON.stringify(items), total],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, success: true });
    }
  );
});

// Получить все заказы (админ)
app.get('/api/orders', authMiddleware, (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Обновить статус заказа
app.put('/api/orders/:id', authMiddleware, (req, res) => {
  const { status } = req.body;
  db.run("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Админка: http://localhost:${PORT}/admin.html`);
});