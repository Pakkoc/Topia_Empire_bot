import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function createPool(config: DatabaseConfig): mysql.Pool {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return pool;
}

export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
