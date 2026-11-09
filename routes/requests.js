/* ==================================================================
   ReliefRoute - relief request routes (raw MySQL via mysql2/promise)
   Mounted at:
     router         -> /api/requests
     dashboardRouter -> /api/dashboard
   ================================================================== */

const express = require('express');
const { pool } = require('../db');

const router = express.Router(); // /api/requests
const dashboardRouter = express.Router(); // /api/dashboard

const REQUEST_STATUSES = ['pending', 'approved', 'dispatched', 'fulfilled'];
const REQUEST_PRIORITIES = ['low', 'medium', 'high'];

// Shared SELECT: request row + requester name + readable category name
const REQUEST_SELECT = `
  SELECT
    rr.id,
    rr.requested_by_user_id,
    rr.category_id,
    rr.location,
    rr.status,
    rr.priority,
    rr.created_at,
    u.name  AS user_name,
    u.role  AS user_role,
    c.name  AS category_name
  FROM relief_requests rr
  LEFT JOIN users u      ON u.id = rr.requested_by_user_id
  LEFT JOIN categories c ON c.id = rr.category_id
`;

// ------------------------------------------------------------------
// GET /api/requests - all requests with user name and category name
// ------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${REQUEST_SELECT} ORDER BY rr.id DESC`);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// POST /api/requests - insert a new relief request
// ------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { requested_by_user_id, category_id, location, priority, status } = req.body || {};

    if (!requested_by_user_id || Number.isNaN(Number(requested_by_user_id))) {
      return res.status(400).json({ message: 'Requested by user id is required' });
    }
    if (!category_id || Number.isNaN(Number(category_id))) {
      return res.status(400).json({ message: 'Category is required' });
    }
    if (!location || !String(location).trim()) {
      return res.status(400).json({ message: 'Location is required' });
    }

    const finalPriority = priority || 'medium';
    if (!REQUEST_PRIORITIES.includes(finalPriority)) {
      return res.status(400).json({ message: `Priority must be one of: ${REQUEST_PRIORITIES.join(', ')}` });
    }

    const finalStatus = status || 'pending';
    if (!REQUEST_STATUSES.includes(finalStatus)) {
      return res.status(400).json({ message: `Status must be one of: ${REQUEST_STATUSES.join(', ')}` });
    }

    const [result] = await pool.execute(
      `INSERT INTO relief_requests
         (requested_by_user_id, category_id, location, status, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(requested_by_user_id),
        Number(category_id),
        String(location).trim(),
        finalStatus,
        finalPriority,
      ]
    );

    const [rows] = await pool.execute(`${REQUEST_SELECT} WHERE rr.id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ message: 'Relief request submitted', request: rows[0] });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Selected user or category does not exist' });
    }
    return next(err);
  }
});

// ------------------------------------------------------------------
// PUT /api/requests/:id/approve - set status to 'approved'
// ------------------------------------------------------------------
router.put('/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const [existing] = await pool.execute(
      `${REQUEST_SELECT} WHERE rr.id = ? LIMIT 1`,
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Relief request not found' });
    }
    if (existing[0].status === 'dispatched' || existing[0].status === 'fulfilled') {
      return res.status(409).json({
        message: `Cannot approve a request that is already ${existing[0].status}`,
      });
    }

    await pool.execute(
      `UPDATE relief_requests
          SET status = 'approved'
        WHERE id = ?
          AND status IN ('pending', 'approved')`,
      [id]
    );

    const [updated] = await pool.execute(`${REQUEST_SELECT} WHERE rr.id = ? LIMIT 1`, [id]);
    return res.json({ message: 'Request approved', request: updated[0] });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// GET /api/dashboard/stats - aggregate counters (single raw query)
//   total_requests  : rows in relief_requests
//   total_resources : rows in resources (inventory count)
//   total_dispatched: rows in resource_dispatches
// ------------------------------------------------------------------
dashboardRouter.get('/stats', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM relief_requests)   AS total_requests,
        (SELECT COUNT(*) FROM resources)         AS total_resources,
        (SELECT COUNT(*) FROM resource_dispatches) AS total_dispatched
    `);
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = { requestsRouter: router, dashboardRouter };
