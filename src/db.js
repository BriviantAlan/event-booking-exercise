import mysql from 'mysql2/promise';

// A shared connection pool. Use `pool.query(sql, params)` for one-off queries,
// or `const conn = await pool.getConnection()` when you need several queries on
// the same connection (for example, a transaction). Always `conn.release()` it.
//
// Docs: https://sidorares.github.io/node-mysql2/docs
export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_USER ?? 'app',
  password: process.env.DB_PASSWORD ?? 'app',
  database: process.env.DB_NAME ?? 'interview',
  connectionLimit: 10,
  // DATETIME columns are stored in UTC. Read them as UTC JavaScript Dates.
  timezone: 'Z',
  // Return DECIMAL results (for example from SUM()) as numbers, not strings.
  decimalNumbers: true,
});
