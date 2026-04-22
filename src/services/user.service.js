import bcrypt from "bcryptjs";
import pool from "../config/database.js";

const MANAGEABLE_ROLE_CODES_BY_PHARMACY_ADMIN = new Set([
  "CASHIER",
  "PHARMACY_ADMIN",
  "BRANCH_ADMIN",
]);
const ALLOWED_STATUS = new Set(["active", "inactive"]);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";
const normalizeRoleCode = (value) => (value ? String(value).toUpperCase() : null);

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizeRequiredString = (value, fieldLabel) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw createHttpError(400, `${fieldLabel} is required`);
  }
  return normalized;
};

const normalizeEmail = (value, required = false) => {
  const normalized = normalizeString(value)?.toLowerCase();

  if (required && !normalized) {
    throw createHttpError(400, "Email is required");
  }

  if (!normalized) return normalized;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw createHttpError(400, "Invalid email format");
  }

  return normalized;
};

const normalizeStatus = (value, required = false) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return required ? "active" : undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!ALLOWED_STATUS.has(normalized)) {
    throw createHttpError(400, "Invalid status. Allowed values: active, inactive");
  }

  return normalized;
};

const parseOptionalInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseRequiredInt = (value, fieldName) => {
  const parsed = parseOptionalInt(value, fieldName);
  if (!parsed) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  return parsed;
};

const getRoleById = async (roleId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, name, code
      FROM roles
      WHERE id = ?
      LIMIT 1
    `,
    [roleId]
  );

  return rows[0] || null;
};

const ensurePharmacyExists = async (pharmacyId) => {
  if (!pharmacyId) return;

  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);
  if (rows.length === 0) {
    throw createHttpError(400, "Pharmacy not found");
  }
};

const getActorContextById = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.status,
        u.pharmacy_id,
        u.role_id,
        u.is_super_admin,
        r.code AS role_code
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  const user = rows[0];
  if (!user) {
    throw createHttpError(401, "Authenticated user not found");
  }

  if (String(user.status).toLowerCase() !== "active") {
    throw createHttpError(403, "Authenticated user is inactive");
  }

  return {
    ...user,
    is_super_admin: normalizeBoolean(user.is_super_admin),
    role_code: normalizeRoleCode(user.role_code),
  };
};

const getUserByIdForManagement = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.pharmacy_id,
        u.role_id,
        u.is_super_admin,
        r.code AS role_code
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    throw createHttpError(404, "User not found");
  }

  return {
    ...rows[0],
    is_super_admin: normalizeBoolean(rows[0].is_super_admin),
    role_code: normalizeRoleCode(rows[0].role_code),
  };
};

const ensureUniqueEmail = async (email, excludedId = null) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM users
      WHERE email = ?
      ${excludedId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    excludedId ? [email, excludedId] : [email]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "Email already registered");
  }
};

const getUserResponseById = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.pharmacy_id,
        p.name AS pharmacy_name,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        u.is_super_admin,
        u.created_by,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    throw createHttpError(404, "User not found");
  }

  const user = rows[0];
  return {
    ...user,
    is_super_admin: normalizeBoolean(user.is_super_admin),
    role_code: normalizeRoleCode(user.role_code),
  };
};

export const getUsersByPharmacyId = async (pharmacyId) => {
  const pharmacyIdNumber = parseRequiredInt(pharmacyId, "pharmacy_id");

  await ensurePharmacyExists(pharmacyIdNumber);

  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.pharmacy_id,
        p.name AS pharmacy_name,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        u.is_super_admin,
        u.created_by,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.pharmacy_id = ?
      ORDER BY u.first_name ASC, u.last_name ASC, u.id ASC
    `,
    [pharmacyIdNumber]
  );

  return rows.map((user) => ({
    ...user,
    is_super_admin: normalizeBoolean(user.is_super_admin),
    role_code: normalizeRoleCode(user.role_code),
  }));
};

export const getRoles = async () => {
  const [rows] = await pool.execute(
    `
      SELECT id, code, name
      FROM roles
      ORDER BY name ASC, id ASC
    `
  );

  return rows.map((role) => ({
    ...role,
    code: normalizeRoleCode(role.code),
  }));
};

const assertPharmacyAdminCanManage = ({
  actor,
  targetRoleCode,
  targetPharmacyId,
  targetIsSuperAdmin = false,
}) => {
  if (actor.role_code !== "PHARMACY_ADMIN") {
    throw createHttpError(403, "You do not have permission to manage users");
  }

  if (!actor.pharmacy_id) {
    throw createHttpError(403, "PHARMACY_ADMIN user has no assigned pharmacy");
  }

  if (targetIsSuperAdmin) {
    throw createHttpError(403, "PHARMACY_ADMIN cannot manage super admin users");
  }

  if (!targetPharmacyId || Number.parseInt(targetPharmacyId, 10) !== Number.parseInt(actor.pharmacy_id, 10)) {
    throw createHttpError(403, "PHARMACY_ADMIN can only manage users in their assigned pharmacy");
  }

  if (!MANAGEABLE_ROLE_CODES_BY_PHARMACY_ADMIN.has(normalizeRoleCode(targetRoleCode))) {
    throw createHttpError(
      403,
      "PHARMACY_ADMIN can only manage roles: CASHIER, PHARMACY_ADMIN, BRANCH_ADMIN"
    );
  }
};

const buildCreatePayload = async (data, actor) => {
  const roleId = parseRequiredInt(data.role_id, "role_id");
  const payloadPharmacyId = parseOptionalInt(data.pharmacy_id, "pharmacy_id");
  const role = await getRoleById(roleId);

  if (!role) {
    throw createHttpError(400, "Role not found");
  }

  const roleCode = normalizeRoleCode(role.code);
  const isSuperAdmin = normalizeBoolean(data.is_super_admin);
  let pharmacyId = payloadPharmacyId;

  if (!actor.is_super_admin) {
    assertPharmacyAdminCanManage({
      actor,
      targetRoleCode: roleCode,
      targetPharmacyId: payloadPharmacyId || actor.pharmacy_id,
      targetIsSuperAdmin: isSuperAdmin,
    });

    if (
      payloadPharmacyId &&
      Number.parseInt(payloadPharmacyId, 10) !== Number.parseInt(actor.pharmacy_id, 10)
    ) {
      throw createHttpError(403, "PHARMACY_ADMIN can only create users in their assigned pharmacy");
    }

    pharmacyId = Number.parseInt(actor.pharmacy_id, 10);
  }

  await ensurePharmacyExists(pharmacyId);

  const plainPassword = normalizeRequiredString(data.password, "Password");
  if (plainPassword.length < 6) {
    throw createHttpError(400, "Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const email = normalizeEmail(data.email, true);
  await ensureUniqueEmail(email);

  return {
    first_name: normalizeRequiredString(data.first_name, "First name"),
    last_name: normalizeRequiredString(data.last_name, "Last name"),
    email,
    pharmacy_id: pharmacyId,
    role_id: roleId,
    password_hash: passwordHash,
    phone: normalizeString(data.phone),
    status: normalizeStatus(data.status, true),
    is_super_admin: actor.is_super_admin ? (isSuperAdmin ? 1 : 0) : 0,
    created_by: actor.id,
  };
};

const buildUpdatePayload = async (currentUser, data, actor) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "first_name")) {
    payload.first_name = normalizeRequiredString(data.first_name, "First name");
  }

  if (Object.prototype.hasOwnProperty.call(data, "last_name")) {
    payload.last_name = normalizeRequiredString(data.last_name, "Last name");
  }

  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    payload.email = normalizeEmail(data.email, true);
    await ensureUniqueEmail(payload.email, currentUser.id);
  }

  if (Object.prototype.hasOwnProperty.call(data, "phone")) {
    payload.phone = normalizeString(data.phone);
  }

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    payload.status = normalizeStatus(data.status, false);
  }

  if (Object.prototype.hasOwnProperty.call(data, "password")) {
    const plainPassword = normalizeRequiredString(data.password, "Password");
    if (plainPassword.length < 6) {
      throw createHttpError(400, "Password must be at least 6 characters");
    }
    payload.password_hash = await bcrypt.hash(plainPassword, 10);
  }

  let nextRoleId = currentUser.role_id;
  let nextRoleCode = currentUser.role_code;
  if (Object.prototype.hasOwnProperty.call(data, "role_id")) {
    nextRoleId = parseRequiredInt(data.role_id, "role_id");
    const role = await getRoleById(nextRoleId);
    if (!role) {
      throw createHttpError(400, "Role not found");
    }
    nextRoleCode = normalizeRoleCode(role.code);
    payload.role_id = nextRoleId;
  }

  let nextPharmacyId = currentUser.pharmacy_id;
  if (Object.prototype.hasOwnProperty.call(data, "pharmacy_id")) {
    nextPharmacyId = parseOptionalInt(data.pharmacy_id, "pharmacy_id");
    await ensurePharmacyExists(nextPharmacyId);
    payload.pharmacy_id = nextPharmacyId;
  }

  let nextIsSuperAdmin = currentUser.is_super_admin;
  if (Object.prototype.hasOwnProperty.call(data, "is_super_admin")) {
    if (!actor.is_super_admin) {
      throw createHttpError(403, "Only super admin can update is_super_admin");
    }
    nextIsSuperAdmin = normalizeBoolean(data.is_super_admin);
    payload.is_super_admin = nextIsSuperAdmin ? 1 : 0;
  }

  if (!actor.is_super_admin) {
    assertPharmacyAdminCanManage({
      actor,
      targetRoleCode: nextRoleCode,
      targetPharmacyId: nextPharmacyId,
      targetIsSuperAdmin: nextIsSuperAdmin,
    });
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, "No valid fields provided for update");
  }

  return payload;
};

export const createUser = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payload = await buildCreatePayload(data, actor);

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO users (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getUserResponseById(result.insertId);
};

export const updateUser = async (userId, data, actorUserId) => {
  const targetUserId = Number.parseInt(userId, 10);
  if (Number.isNaN(targetUserId) || targetUserId <= 0) {
    throw createHttpError(400, "Invalid user id");
  }

  const actor = await getActorContextById(actorUserId);
  const currentUser = await getUserByIdForManagement(targetUserId);
  const payload = await buildUpdatePayload(currentUser, data, actor);

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, targetUserId]);

  return getUserResponseById(targetUserId);
};
