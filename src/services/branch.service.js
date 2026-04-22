import pool from "../config/database.js";

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

const normalizeEmail = (value) => {
  const normalized = normalizeString(value)?.toLowerCase();
  if (!normalized) return normalized;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw createHttpError(400, "Invalid email format");
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

const normalizeIsMain = (value, required = false) => {
  if (value === undefined || value === null || value === "") {
    return required ? 0 : undefined;
  }

  return normalizeBoolean(value) ? 1 : 0;
};

const getActorContextById = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.status,
        u.pharmacy_id,
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

  const normalized = {
    ...user,
    is_super_admin: normalizeBoolean(user.is_super_admin),
    role_code: normalizeRoleCode(user.role_code),
  };

  const isAllowedRole = normalized.is_super_admin || normalized.role_code === "PHARMACY_ADMIN";
  if (!isAllowedRole) {
    throw createHttpError(403, "Only super admin or PHARMACY_ADMIN can manage branches");
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "PHARMACY_ADMIN user has no assigned pharmacy");
  }

  return normalized;
};

const ensurePharmacyExists = async (pharmacyId) => {
  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);

  if (rows.length === 0) {
    throw createHttpError(400, "Pharmacy not found");
  }
};

const getBranchById = async (branchId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        b.id,
        b.pharmacy_id,
        p.name AS pharmacy_name,
        b.code,
        b.name,
        b.phone,
        b.email,
        b.address,
        b.city,
        b.status,
        b.is_main,
        b.created_by,
        b.updated_by,
        b.created_at,
        b.updated_at
      FROM branches b
      JOIN pharmacies p ON p.id = b.pharmacy_id
      WHERE b.id = ?
      LIMIT 1
    `,
    [branchId]
  );

  return rows[0] || null;
};

const ensureUniqueBranchCode = async (pharmacyId, code, excludedId = null) => {
  if (!code) return;

  const [rows] = await pool.execute(
    `
      SELECT id
      FROM branches
      WHERE pharmacy_id = ? AND code = ?
      ${excludedId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    excludedId ? [pharmacyId, code, excludedId] : [pharmacyId, code]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "Branch code already exists for this pharmacy");
  }
};

const assertPharmacyAccess = (actor, pharmacyId) => {
  if (actor.is_super_admin) return;

  if (Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(pharmacyId, 10)) {
    throw createHttpError(403, "PHARMACY_ADMIN can only manage branches of assigned pharmacy");
  }
};

export const createBranch = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);

  let pharmacyId = parseRequiredInt(data.pharmacy_id, "pharmacy_id");
  if (!actor.is_super_admin) {
    pharmacyId = Number.parseInt(actor.pharmacy_id, 10);
  }

  assertPharmacyAccess(actor, pharmacyId);
  await ensurePharmacyExists(pharmacyId);

  const payload = {
    pharmacy_id: pharmacyId,
    created_by: actor.id,
    updated_by: actor.id,
    code: normalizeString(data.code),
    name: normalizeRequiredString(data.name, "Name"),
    phone: normalizeString(data.phone),
    email: normalizeEmail(data.email),
    address: normalizeString(data.address),
    city: normalizeString(data.city),
    status: normalizeStatus(data.status, true),
    is_main: normalizeIsMain(data.is_main, true),
  };

  await ensureUniqueBranchCode(payload.pharmacy_id, payload.code);

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO branches (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getBranchById(result.insertId);
};

export const getBranches = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");
  const status = normalizeStatus(params.status, false);
  const search = normalizeString(params.search);

  let pharmacyId = null;
  if (actor.is_super_admin) {
    pharmacyId = payloadPharmacyId;
    if (pharmacyId) {
      await ensurePharmacyExists(pharmacyId);
    }
  } else {
    pharmacyId = Number.parseInt(actor.pharmacy_id, 10);
    if (payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
      throw createHttpError(403, "PHARMACY_ADMIN can only view branches of assigned pharmacy");
    }
  }

  const where = [];
  const values = [];

  if (pharmacyId) {
    where.push("b.pharmacy_id = ?");
    values.push(pharmacyId);
  }

  if (status) {
    where.push("b.status = ?");
    values.push(status);
  }

  if (search) {
    where.push(
      "(LOWER(b.name) LIKE LOWER(?) OR LOWER(b.code) LIKE LOWER(?) OR LOWER(b.city) LIKE LOWER(?))"
    );
    const searchTerm = `%${search}%`;
    values.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `
      SELECT
        b.id,
        b.pharmacy_id,
        p.name AS pharmacy_name,
        b.code,
        b.name,
        b.phone,
        b.email,
        b.address,
        b.city,
        b.status,
        b.is_main,
        b.created_by,
        b.updated_by,
        b.created_at,
        b.updated_at
      FROM branches b
      JOIN pharmacies p ON p.id = b.pharmacy_id
      ${whereClause}
      ORDER BY p.name ASC, b.is_main DESC, b.name ASC
    `,
    values
  );

  return {
    pharmacy_id: pharmacyId,
    total: rows.length,
    items: rows,
  };
};

export const updateBranch = async (branchId, data, actorUserId) => {
  const targetBranchId = Number.parseInt(branchId, 10);
  if (Number.isNaN(targetBranchId) || targetBranchId <= 0) {
    throw createHttpError(400, "Invalid branch id");
  }

  const actor = await getActorContextById(actorUserId);
  const currentBranch = await getBranchById(targetBranchId);

  if (!currentBranch) {
    throw createHttpError(404, "Branch not found");
  }

  assertPharmacyAccess(actor, currentBranch.pharmacy_id);

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "pharmacy_id")) {
    if (!actor.is_super_admin) {
      throw createHttpError(403, "PHARMACY_ADMIN cannot change branch pharmacy");
    }

    const pharmacyId = parseRequiredInt(data.pharmacy_id, "pharmacy_id");
    await ensurePharmacyExists(pharmacyId);
    payload.pharmacy_id = pharmacyId;
  }

  if (Object.prototype.hasOwnProperty.call(data, "code")) {
    payload.code = normalizeString(data.code);
  }

  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = normalizeRequiredString(data.name, "Name");
  }

  if (Object.prototype.hasOwnProperty.call(data, "phone")) {
    payload.phone = normalizeString(data.phone);
  }

  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    payload.email = normalizeEmail(data.email);
  }

  if (Object.prototype.hasOwnProperty.call(data, "address")) {
    payload.address = normalizeString(data.address);
  }

  if (Object.prototype.hasOwnProperty.call(data, "city")) {
    payload.city = normalizeString(data.city);
  }

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    payload.status = normalizeStatus(data.status, false);
  }

  if (Object.prototype.hasOwnProperty.call(data, "is_main")) {
    payload.is_main = normalizeIsMain(data.is_main, false);
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, "No valid fields provided for update");
  }

  payload.updated_by = actor.id;

  const nextPharmacyId = payload.pharmacy_id || currentBranch.pharmacy_id;
  const nextCode = Object.prototype.hasOwnProperty.call(payload, "code")
    ? payload.code
    : currentBranch.code;

  await ensureUniqueBranchCode(nextPharmacyId, nextCode, targetBranchId);

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE branches SET ${setClause} WHERE id = ?`, [...values, targetBranchId]);

  return getBranchById(targetBranchId);
};
