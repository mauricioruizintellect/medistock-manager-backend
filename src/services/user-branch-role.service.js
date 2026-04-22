import pool from "../config/database.js";

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_ROLE_CODES = new Set(["CASHIER", "BRANCH_ADMIN"]);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";
const normalizeRoleCode = (value) => (value ? String(value).toUpperCase() : null);

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

const normalizeIsDefault = (value, required = false) => {
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

  const isAllowed = normalized.is_super_admin || normalized.role_code === "PHARMACY_ADMIN";
  if (!isAllowed) {
    throw createHttpError(403, "Only super admin or PHARMACY_ADMIN can manage user branch roles");
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "PHARMACY_ADMIN user has no assigned pharmacy");
  }

  return normalized;
};

const getRoleById = async (roleId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, code, name
      FROM roles
      WHERE id = ?
      LIMIT 1
    `,
    [roleId]
  );

  if (!rows[0]) {
    throw createHttpError(400, "Role not found");
  }

  return rows[0];
};

const ensurePharmacyExists = async (pharmacyId) => {
  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);

  if (rows.length === 0) {
    throw createHttpError(400, "Pharmacy not found");
  }
};

const validateAssignableRole = (role) => {
  const roleCode = normalizeRoleCode(role.code);
  if (!ALLOWED_ROLE_CODES.has(roleCode)) {
    throw createHttpError(400, "Only CASHIER and BRANCH_ADMIN roles can be assigned");
  }
};

const getUserById = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, pharmacy_id, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    throw createHttpError(400, "User not found");
  }

  return rows[0];
};

const getBranchById = async (branchId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, pharmacy_id, status
      FROM branches
      WHERE id = ?
      LIMIT 1
    `,
    [branchId]
  );

  if (!rows[0]) {
    throw createHttpError(400, "Branch not found");
  }

  return rows[0];
};

const assertPharmacyAccess = ({ actor, user, branch }) => {
  if (user.pharmacy_id !== branch.pharmacy_id) {
    throw createHttpError(400, "User and branch must belong to the same pharmacy");
  }

  if (!actor.is_super_admin) {
    const actorPharmacyId = Number.parseInt(actor.pharmacy_id, 10);
    const targetPharmacyId = Number.parseInt(branch.pharmacy_id, 10);

    if (actorPharmacyId !== targetPharmacyId) {
      throw createHttpError(403, "PHARMACY_ADMIN can only manage records in assigned pharmacy");
    }
  }
};

const assertActorCanAccessPharmacy = (actor, pharmacyId) => {
  if (actor.is_super_admin) return;

  if (Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(pharmacyId, 10)) {
    throw createHttpError(403, "PHARMACY_ADMIN can only manage records in assigned pharmacy");
  }
};

const getUserBranchRoleById = async (id) => {
  const [rows] = await pool.execute(
    `
      SELECT
        ubr.id,
        ubr.user_id,
        ubr.branch_id,
        ubr.role_id,
        ubr.is_default,
        ubr.status,
        ubr.created_at,
        ubr.updated_at,
        b.pharmacy_id,
        r.code AS role_code
      FROM user_branch_roles ubr
      JOIN branches b ON b.id = ubr.branch_id
      JOIN roles r ON r.id = ubr.role_id
      WHERE ubr.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

export const getUserBranchRoles = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);

  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");
  const branchId = parseOptionalInt(params.branch_id, "branch_id");
  const userId = parseOptionalInt(params.user_id, "user_id");
  const roleId = parseOptionalInt(params.role_id, "role_id");
  const status = normalizeStatus(params.status, false);

  let pharmacyId = actor.is_super_admin ? payloadPharmacyId : Number.parseInt(actor.pharmacy_id, 10);

  if (payloadPharmacyId) {
    await ensurePharmacyExists(payloadPharmacyId);
    assertActorCanAccessPharmacy(actor, payloadPharmacyId);
  }

  if (branchId) {
    const branch = await getBranchById(branchId);
    assertActorCanAccessPharmacy(actor, branch.pharmacy_id);

    if (pharmacyId && Number.parseInt(branch.pharmacy_id, 10) !== pharmacyId) {
      throw createHttpError(400, "branch_id does not belong to pharmacy_id");
    }

    pharmacyId = Number.parseInt(branch.pharmacy_id, 10);
  }

  if (userId) {
    const user = await getUserById(userId);
    assertActorCanAccessPharmacy(actor, user.pharmacy_id);

    if (pharmacyId && Number.parseInt(user.pharmacy_id, 10) !== pharmacyId) {
      throw createHttpError(400, "user_id does not belong to pharmacy_id");
    }

    pharmacyId = Number.parseInt(user.pharmacy_id, 10);
  }

  if (roleId) {
    const role = await getRoleById(roleId);
    validateAssignableRole(role);
  }

  const where = [];
  const values = [];

  if (pharmacyId) {
    where.push("b.pharmacy_id = ?");
    values.push(pharmacyId);
  }

  if (branchId) {
    where.push("ubr.branch_id = ?");
    values.push(branchId);
  }

  if (userId) {
    where.push("ubr.user_id = ?");
    values.push(userId);
  }

  if (roleId) {
    where.push("ubr.role_id = ?");
    values.push(roleId);
  }

  if (status) {
    where.push("ubr.status = ?");
    values.push(status);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `
      SELECT
        ubr.id,
        ubr.user_id,
        u.first_name,
        u.last_name,
        u.email AS user_email,
        ubr.branch_id,
        b.name AS branch_name,
        b.pharmacy_id,
        p.name AS pharmacy_name,
        ubr.role_id,
        r.code AS role_code,
        r.name AS role_name,
        ubr.is_default,
        ubr.status,
        ubr.created_at,
        ubr.updated_at
      FROM user_branch_roles ubr
      JOIN users u ON u.id = ubr.user_id
      JOIN branches b ON b.id = ubr.branch_id
      JOIN pharmacies p ON p.id = b.pharmacy_id
      JOIN roles r ON r.id = ubr.role_id
      ${whereClause}
      ORDER BY p.name ASC, b.name ASC, u.first_name ASC, u.last_name ASC, r.name ASC
    `,
    values
  );

  return {
    pharmacy_id: pharmacyId,
    branch_id: branchId,
    user_id: userId,
    role_id: roleId,
    total: rows.length,
    items: rows.map((row) => ({
      ...row,
      role_code: normalizeRoleCode(row.role_code),
      is_default: normalizeBoolean(row.is_default),
    })),
  };
};

const getUserBranchRoleResponseById = async (id) => {
  const [rows] = await pool.execute(
    `
      SELECT
        ubr.id,
        ubr.user_id,
        u.first_name,
        u.last_name,
        u.email AS user_email,
        ubr.branch_id,
        b.name AS branch_name,
        b.pharmacy_id,
        ubr.role_id,
        r.code AS role_code,
        r.name AS role_name,
        ubr.is_default,
        ubr.status,
        ubr.created_at,
        ubr.updated_at
      FROM user_branch_roles ubr
      JOIN users u ON u.id = ubr.user_id
      JOIN branches b ON b.id = ubr.branch_id
      JOIN roles r ON r.id = ubr.role_id
      WHERE ubr.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw createHttpError(404, "User branch role not found");
  }

  return {
    ...rows[0],
    role_code: normalizeRoleCode(rows[0].role_code),
    is_default: normalizeBoolean(rows[0].is_default),
  };
};

const ensureUniqueRecord = async ({ userId, branchId, roleId, excludedId = null }) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM user_branch_roles
      WHERE user_id = ? AND branch_id = ? AND role_id = ?
      ${excludedId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    excludedId ? [userId, branchId, roleId, excludedId] : [userId, branchId, roleId]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "This user already has that role assigned for this branch");
  }
};

export const createUserBranchRole = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);

  const userId = parseRequiredInt(data.user_id, "user_id");
  const branchId = parseRequiredInt(data.branch_id, "branch_id");
  const roleId = parseRequiredInt(data.role_id, "role_id");

  const user = await getUserById(userId);
  const branch = await getBranchById(branchId);
  const role = await getRoleById(roleId);

  validateAssignableRole(role);
  assertPharmacyAccess({ actor, user, branch });
  await ensureUniqueRecord({ userId, branchId, roleId });

  const payload = {
    user_id: userId,
    branch_id: branchId,
    role_id: roleId,
    is_default: normalizeIsDefault(data.is_default, true),
    status: normalizeStatus(data.status, true),
  };

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO user_branch_roles (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getUserBranchRoleResponseById(result.insertId);
};

export const deleteUserBranchRole = async (id, actorUserId) => {
  const recordId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const current = await getUserBranchRoleById(recordId);

  if (!current) {
    throw createHttpError(404, "User branch role not found");
  }

  const user = await getUserById(current.user_id);
  const branch = await getBranchById(current.branch_id);
  assertPharmacyAccess({ actor, user, branch });

  await pool.execute("DELETE FROM user_branch_roles WHERE id = ?", [recordId]);

  return {
    id: recordId,
    deleted: true,
  };
};
