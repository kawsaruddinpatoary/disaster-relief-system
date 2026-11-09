require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const { pool, testConnection } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'volunteer', 'donor'];
const RESOURCE_STATUSES = ['available', 'reserved', 'dispatched'];
const SCRYPT = { N: 16384, r: 8, p: 1 };

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------
// Password helpers (Node crypto - scrypt, no extra dependency)
// ------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64, SCRYPT);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

// ==================================================================
// AUTH
// ==================================================================
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email || !EMAIL_REGEX.test(String(email))) return res.status(400).json({ message: 'A valid email is required' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!role || !ROLES.includes(role)) return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}` });

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [String(name).trim(), String(email).trim().toLowerCase(), hashPassword(String(password)), role]
    );

    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: result.insertId, name: String(name).trim(), email: String(email).trim().toLowerCase(), role },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    return next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const [rows] = await pool.execute(
      'SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1',
      [String(email).trim().toLowerCase()]
    );

    if (rows.length === 0 || !verifyPassword(String(password), rows[0].password)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return res.json({ message: 'Login successful', user: publicUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

// ==================================================================
// CATEGORIES (populates the "add resource" dropdown)
// ==================================================================
app.get('/api/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, description FROM categories ORDER BY id ASC'
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ==================================================================
// RESOURCES
// ==================================================================
const RESOURCE_SELECT = `
  SELECT
    r.id,
    r.category_id,
    r.name,
    r.quantity,
    r.status,
    r.location,
    r.created_at,
    c.name AS category_name
  FROM resources r
  LEFT JOIN categories c ON c.id = r.category_id
`;

app.get('/api/resources', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${RESOURCE_SELECT} ORDER BY r.id DESC`);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

app.post('/api/resources', async (req, res, next) => {
  try {
    const { category_id, name, quantity, status, location } = req.body || {};

    if (!category_id || Number.isNaN(Number(category_id))) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Resource name is required' });
    if (quantity === undefined || quantity === '' || Number(quantity) < 0 || !Number.isInteger(Number(quantity))) {
      return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
    }
    const finalStatus = status || 'available';
    if (!RESOURCE_STATUSES.includes(finalStatus)) {
      return res.status(400).json({ message: `Status must be one of: ${RESOURCE_STATUSES.join(', ')}` });
    }
    if (!location || !String(location).trim()) return res.status(400).json({ message: 'Location is required' });

    const [result] = await pool.execute(
      'INSERT INTO resources (category_id, name, quantity, status, location) VALUES (?, ?, ?, ?, ?)',
      [Number(category_id), String(name).trim(), Number(quantity), finalStatus, String(location).trim()]
    );

    const [rows] = await pool.execute(`${RESOURCE_SELECT} WHERE r.id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ message: 'Resource added', resource: rows[0] });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Selected category does not exist' });
    }
    return next(err);
  }
});

// ==================================================================
// Errors / 404
// ==================================================================
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`Disaster Relief API running on http://localhost:${PORT}`);
  try {
    await testConnection();
  } catch (err) {
    console.error('[db] connection failed ->', err.message);
    console.error('[db] check your .env (DB_HOST / DB_USER / DB_PASSWORD / DB_NAME)');
  }
});
