import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * TODO (Part 1): GET /events
 */
router.get('/', async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * TODO (Part 1): GET /events/:id
 */
router.get('/:id', async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

/**
 * TODO (Part 2): POST /events/:id/bookings
 */
router.post('/:id/bookings', async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
