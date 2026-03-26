import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";

const buildJwtToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw createHttpError(500, "JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      is_super_admin: normalizeBoolean(user.is_super_admin),
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    }
  );
};

const getUserByEmail = async (email) => {
  const query = `
    SELECT
      id,
      first_name,
      last_name,
      email,
      password_hash,
      status,
      is_super_admin
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  const [rows] = await pool.execute(query, [email]);
  return rows[0] || null;
};

const getUserById = async (userId) => {
  const query = `
    SELECT
      id,
      first_name,
      last_name,
      email,
      status,
      is_super_admin
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  const [rows] = await pool.execute(query, [userId]);
  return rows[0] || null;
};

const getUserPharmaciesAndRoles = async (userId) => {
  const query = `
    SELECT
      p.id AS pharmacy_id,
      p.name AS pharmacy_name,
      r.id AS role_id,
      r.name AS role_name,
      r.code AS role_code
    FROM user_pharmacy_roles upr
    JOIN pharmacies p ON p.id = upr.pharmacy_id
    JOIN roles r ON r.id = upr.role_id
    WHERE upr.user_id = ?
    ORDER BY p.id ASC
  `;

  const [rows] = await pool.execute(query, [userId]);

  return rows.map((row) => ({
    pharmacy_id: row.pharmacy_id,
    pharmacy_name: row.pharmacy_name,
    role: {
      id: row.role_id,
      name: String(row.role_code || row.role_name || "").toUpperCase(),
    },
  }));
};

const updateLastLoginAt = async (userId) => {
  await pool.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
};

const shapeUserResponse = async (user) => {
  const isSuperAdmin = normalizeBoolean(user.is_super_admin);

  const userData = {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    is_super_admin: isSuperAdmin,
  };

  if (!isSuperAdmin) {
    userData.pharmacies = await getUserPharmaciesAndRoles(user.id);
  }

  return userData;
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw createHttpError(400, "Email and password are required");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await getUserByEmail(normalizedEmail);

  if (!user) {
    throw createHttpError(401, "Invalid credentials");
  }

  if (String(user.status).toLowerCase() !== "active") {
    throw createHttpError(403, "User account is inactive");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw createHttpError(401, "Invalid credentials");
  }

  await updateLastLoginAt(user.id);

  const token = buildJwtToken(user);
  const userResponse = await shapeUserResponse(user);

  return {
    token,
    user: userResponse,
  };
};

export const getAuthenticatedUser = async (userId) => {
  const user = await getUserById(userId);

  if (!user) {
    throw createHttpError(401, "User not found");
  }

  if (String(user.status).toLowerCase() !== "active") {
    throw createHttpError(403, "User account is inactive");
  }

  return shapeUserResponse(user);
};
