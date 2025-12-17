import { createPool, getPool, type DatabaseConfig } from "@topia/infra";

let initialized = false;

export function initDatabase() {
  if (initialized) {
    return getPool();
  }

  const config: DatabaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "topia_empire",
  };

  initialized = true;
  return createPool(config);
}

export function db() {
  return initDatabase();
}
