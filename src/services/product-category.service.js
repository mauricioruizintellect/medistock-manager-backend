import pool from "../config/database.js";

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_ROLE_CODES = new Set(["PHARMACY_ADMIN", "BRANCH_ADMIN"]);

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

const normalizeRequiredString = (value, fieldName) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required`);
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

const parseRequiredInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} is required and must be a positive integer`);
  }
  return parsed;
};

const parseOptionalInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  return parseRequiredInt(value, fieldName);
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

  const actor = rows[0];
  if (!actor) {
    throw createHttpError(401, "Authenticated user not found");
  }

  if (String(actor.status).toLowerCase() !== "active") {
    throw createHttpError(403, "Authenticated user is inactive");
  }

  const normalized = {
    ...actor,
    is_super_admin: normalizeBoolean(actor.is_super_admin),
    role_code: normalizeRoleCode(actor.role_code),
  };

  const canManage = normalized.is_super_admin || ALLOWED_ROLE_CODES.has(normalized.role_code);
  if (!canManage) {
    throw createHttpError(
      403,
      "Only SUPER_ADMIN, PHARMACY_ADMIN or BRANCH_ADMIN can manage categories"
    );
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "User has no assigned pharmacy");
  }

  return normalized;
};

const ensurePharmacyExists = async (pharmacyId) => {
  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);
  if (rows.length === 0) {
    throw createHttpError(400, "Pharmacy not found");
  }
};

const ensureUniqueCategoryNameInPharmacy = async (pharmacyId, name) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM product_categories
      WHERE pharmacy_id = ? AND LOWER(name) = LOWER(?)
      LIMIT 1
    `,
    [pharmacyId, name]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "Category name already exists in this pharmacy");
  }
};

const getCategoryById = async (id) => {
  const [rows] = await pool.execute(
    `
      SELECT
        pc.id,
        pc.pharmacy_id,
        p.name AS pharmacy_name,
        pc.name,
        pc.description,
        pc.status,
        pc.created_by,
        pc.updated_by,
        pc.created_at,
        pc.updated_at
      FROM product_categories pc
      JOIN pharmacies p ON p.id = pc.pharmacy_id
      WHERE pc.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

export const createCategory = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(data.pharmacy_id, "pharmacy_id");

  const pharmacyId = actor.is_super_admin
    ? parseRequiredInt(payloadPharmacyId, "pharmacy_id")
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!actor.is_super_admin && payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
    throw createHttpError(403, "You can only create categories in your assigned pharmacy");
  }

  await ensurePharmacyExists(pharmacyId);

  const name = normalizeRequiredString(data.name, "name");
  await ensureUniqueCategoryNameInPharmacy(pharmacyId, name);

  const payload = {
    pharmacy_id: pharmacyId,
    name,
    description: normalizeString(data.description),
    status: normalizeStatus(data.status, true),
    created_by: actor.id,
    updated_by: actor.id,
  };

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO product_categories (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getCategoryById(result.insertId);
};

export const getCategoriesByPharmacy = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");

  const pharmacyId = actor.is_super_admin
    ? parseRequiredInt(payloadPharmacyId, "pharmacy_id")
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!actor.is_super_admin && payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
    throw createHttpError(403, "You can only view categories from your assigned pharmacy");
  }

  await ensurePharmacyExists(pharmacyId);

  const [rows] = await pool.execute(
    `
      SELECT
        pc.id,
        pc.pharmacy_id,
        p.name AS pharmacy_name,
        pc.name,
        pc.description,
        pc.status,
        pc.created_by,
        pc.updated_by,
        pc.created_at,
        pc.updated_at
      FROM product_categories pc
      JOIN pharmacies p ON p.id = pc.pharmacy_id
      WHERE pc.pharmacy_id = ?
      ORDER BY pc.name ASC
    `,
    [pharmacyId]
  );

  return {
    pharmacy_id: pharmacyId,
    total: rows.length,
    items: rows,
  };
};
