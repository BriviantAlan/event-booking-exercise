import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * GET /users/:id
 *
 * Already implemented. Use it as an example of the conventions in README.md.
 */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }

  // Always use placeholders (?) for values. Never build SQL from strings.
  const [rows] = await pool.query(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
    [id],
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(rows[0]);
});

/**
 * TODO (Part 3): GET /users/:id/bookings
 */
router.get('/:id/bookings', async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
