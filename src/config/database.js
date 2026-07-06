import mysql from "mysql2/promise";

const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: toPort(process.env.DB_PORT, 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const testDatabaseConnection = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log("✅ Conexión a MySQL exitosa");
  } finally {
    connection.release();
  }
};

export default pool;