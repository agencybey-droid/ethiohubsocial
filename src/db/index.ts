import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (!process.env.SQL_HOST) {
      // Running on serverless / Vercel without Cloud SQL credentials
      const dummyPool = new Pool({
        connectionTimeoutMillis: 1000,
      });
      dummyPool.on('error', () => {});
      global._postgresPool = dummyPool;
      return global._postgresPool;
    }

    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    global._postgresPool.on('error', (err) => {
      console.warn('Postgres pool note:', err.message);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
