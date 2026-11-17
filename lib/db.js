import { Pool, types } from 'pg';

// bigint (COUNT) and numeric (ROUND) come back as strings by default - parse them to numbers
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
// keep DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts in the UI)
types.setTypeParser(1082, (v) => v);

// credentials come ONLY from environment variables (.env) - nothing is hard-coded
const globalForPg = globalThis;
export const pool =
  globalForPg.__pgPool ||
  (globalForPg.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));

export const query = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN ... COMMIT; any error triggers ROLLBACK (atomic unit of work)
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
