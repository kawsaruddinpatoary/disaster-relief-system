/* ==================================================================
   ReliefRoute - resource dispatch routes (raw MySQL via mysql2/promise)
   Mounted at: /api/dispatches
   ================================================================== */

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Shared SELECT: dispatch row + request, resource and volunteer names
const DISPATCH_SELECT = `
  SELECT
    d.id,
    d.request_id,
    d.resource_id,
    d.volunteer_id,
    d.dispatch_date,
    rr.location      AS request_location,
    rr.status        AS request_status,
    rr.priority      AS request_priority,
    r.name           AS resource_name,
    r.quantity       AS resource_quantity,
    r.location       AS resource_location,
    v.name           AS volunteer_name
  FROM resource_dispatches d
  LEFT JOIN relief_requests rr ON rr.id = d.request_id
  LEFT JOIN resources r        ON r.id  = d.resource_id
  LEFT JOIN users v            ON v.id  = d.volunteer_id
`;

// ------------------------------------------------------------------
// GET /api/dispatches - all dispatches with joined names
// ------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${DISPATCH_SELECT} ORDER BY d.dispatch_date DESC, d.id DESC`);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------------
// POST /api/dispatches - create a dispatch, move request + resource
//                        to 'dispatched' (single transaction)
// ------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  const { request_id, resource_id, volunteer_id, dispatch_date } = req.body || {};

  if (!request_id || Number.isNaN(Number(request_id))) {
    return res.status(400).json({ message: 'Request id is required' });
  }
  if (!resource_id || Number.isNaN(Number(resource_id))) {
    return res.status(400).json({ message: 'Resource id is required' });
  }
  if (!volunteer_id || Number.isNaN(Number(volunteer_id))) {
    return res.status(400).json({ message: 'Volunteer id is required' });
  }
  if (dispatch_date !== undefined && dispatch_date !== '' && Number.isNaN(Date.parse(dispatch_date))) {
    return res.status(400).json({ message: 'Dispatch date must be a valid timestamp' });
  }

  const hasDate = dispatch_date !== undefined && dispatch_date !== '';
  const insertSql = hasDate
    ? `INSERT INTO resource_dispatches (request_id, resource_id, volunteer_id, dispatch_date)
       VALUES (?, ?, ?, ?)`
    : `INSERT INTO resource_dispatches (request_id, resource_id, volunteer_id)
       VALUES (?, ?, ?)`;
  const insertParams = hasDate
    ? [Number(request_id), Number(resource_id), Number(volunteer_id), new Date(dispatch_date)]
    : [Number(request_id), Number(resource_id), Number(volunteer_id)];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(insertSql, insertParams);

    // Route the request and the stock item into 'dispatched'
    await conn.execute(
      `UPDATE relief_requests SET status = 'dispatched' WHERE id = ?`,
      [Number(request_id)]
    );
    await conn.execute(
      `UPDATE resources SET status = 'dispatched' WHERE id = ?`,
      [Number(resource_id)]
    );

    await conn.commit();

    const [rows] = await conn.execute(`${DISPATCH_SELECT} WHERE d.id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ message: 'Dispatch created', dispatch: rows[0] });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* connection already broken - ignore */
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Selected request, resource or volunteer does not exist' });
    }
    return next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
