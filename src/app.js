import express from 'express';
import { pool } from './db.js';
import usersRouter from './routes/users.js';
import eventsRouter from './routes/events.js';
import bookingsRouter from './routes/bookings.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  });

  app.use('/users', usersRouter);
  app.use('/events', eventsRouter);
  app.use('/bookings', bookingsRouter);

  // Unknown routes
  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  });

  // Error handler. Express 5 forwards errors thrown in async handlers here.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
