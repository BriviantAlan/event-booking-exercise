import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * TODO (Part 3): POST /bookings/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
