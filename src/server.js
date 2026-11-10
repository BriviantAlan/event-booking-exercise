import { createApp } from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 3000);

const server = createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
