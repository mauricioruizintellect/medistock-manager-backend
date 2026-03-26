import mysql from "mysql2/promise";

const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: toPort(process.env.DB_PORT, 3306),
  database: process.env.DB_NAME || "farmacia_db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "e48SJUV@es^eVICV",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const testDatabaseConnection = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
};

export default pool;
