require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const allowedOrigins = new Set([
  'null',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
]);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    })
  : null;

const requireDatabase = (req, res, next) => {
  if (pool) return next();
  return res.status(503).json({
    error: 'Chua cau hinh DATABASE_URL. Vui long them DATABASE_URL vao file .env roi khoi dong lai server.',
  });
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// Parse JSON request bodies
app.use(express.json());

// Initialize Database Table on Startup
const initDb = async () => {
  if (!pool) {
    console.warn('DATABASE_URL is not set; RSVP API will return 503 until it is configured.');
    return;
  }

  const queryText = `
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      relationship VARCHAR(100),
      wishes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    const client = await pool.connect();
    try {
      await client.query(queryText);
      console.log('Successfully initialized PostgreSQL table "rsvps"');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to initialize database table:', err.message);
  }
};

initDb();

// Securely serve only index.html on root path (avoid serving server.js, .env, or package.json)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: Boolean(pool) });
});

// Handle RSVP Submission
app.post('/api/rsvp', requireDatabase, async (req, res) => {
  let { name, status, relationship, wishes } = req.body;

  // Basic Validation
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Họ và tên là bắt buộc và phải là chuỗi hợp lệ.' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Trạng thái tham gia là bắt buộc.' });
  }

  name = name.trim();
  status = status.trim();
  relationship = typeof relationship === 'string' ? relationship.trim() : 'Khác';
  wishes = typeof wishes === 'string' ? wishes.trim() : '';

  // Limit lengths to avoid DB spam/abuse
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Họ và tên phải từ 2 đến 100 ký tự.' });
  }
  if (wishes.length > 1000) {
    return res.status(400).json({ error: 'Lời chúc không được vượt quá 1000 ký tự.' });
  }

  try {
    const insertQuery = `
      INSERT INTO rsvps (name, status, relationship, wishes)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, status, created_at;
    `;
    const values = [name, status, relationship, wishes];

    // Using pool.query directly handles opening, executing, and returning the client back to the pool automatically.
    const result = await pool.query(insertQuery, values);
    
    return res.status(201).json({
      success: true,
      message: 'Đăng ký tham gia thành công!',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error inserting RSVP into database:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi lưu thông tin. Vui lòng thử lại sau.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try PORT=3001 npm run dev`);
    process.exit(1);
  }
  throw err;
});
