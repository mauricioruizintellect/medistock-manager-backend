import pool from "../config/database.js";

const ALLOWED_ROLE_CODES = new Set(["PHARMACY_ADMIN", "BRANCH_ADMIN"]);
const ALLOWED_MOVEMENT_TYPES = new Set(["initial_load", "sale", "in", "out", "adjustment"]);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";
const normalizeRoleCode = (value) => (value ? String(value).toUpperCase() : null);

const parseOptionalInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
};

const normalizeMovementType = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;

  const normalized = String(value).trim().toLowerCase();
  const databaseValue = normalized === "purchase" ? "in" : normalized;

  if (!ALLOWED_MOVEMENT_TYPES.has(databaseValue)) {
    throw createHttpError(
      400,
      "Invalid movement_type. Allowed values: initial_load, sale, purchase, in, out, adjustment"
    );
  }

  return databaseValue;
};

const normalizeDate = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;

  const normalized = String(value).trim();
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} is invalid`);
  }

  return normalized;
};

const toNumber = (value) => (value === null || value === undefined ? value : Number.parseFloat(value));

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

  const canView = normalized.is_super_admin || ALLOWED_ROLE_CODES.has(normalized.role_code);
  if (!canView) {
    throw createHttpError(
      403,
      "Only SUPER_ADMIN, PHARMACY_ADMIN or BRANCH_ADMIN can view inventory"
    );
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "User has no assigned pharmacy");
  }

  return normalized;
};

const buildInventoryScope = async (params, actor) => {
  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");
  const branchId = parseOptionalInt(params.branch_id, "branch_id");
  const productId = parseOptionalInt(params.product_id, "product_id");
  const branchProductId = parseOptionalInt(params.branch_product_id, "branch_product_id");

  const pharmacyId = actor.is_super_admin
    ? payloadPharmacyId
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!actor.is_super_admin && payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
    throw createHttpError(403, "You can only view inventory from your assigned pharmacy");
  }

  return {
    pharmacyId,
    branchId,
    productId,
    branchProductId,
  };
};

const appendScopeFilters = (where, values, scope) => {
  if (scope.pharmacyId) {
    where.push("b.pharmacy_id = ?");
    values.push(scope.pharmacyId);
  }

  if (scope.branchId) {
    where.push("bp.branch_id = ?");
    values.push(scope.branchId);
  }

  if (scope.productId) {
    where.push("bp.product_id = ?");
    values.push(scope.productId);
  }

  if (scope.branchProductId) {
    where.push("bp.id = ?");
    values.push(scope.branchProductId);
  }
};

export const getInventoryStock = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const scope = await buildInventoryScope(params, actor);
  const where = [];
  const values = [];

  appendScopeFilters(where, values, scope);

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `
      SELECT
        bp.id AS branch_product_id,
        b.name AS branch_name,
        p.name AS product_name,
        p.sku,
        bp.current_stock,
        bp.min_stock,
        (
          SELECT il.lot_number
          FROM inventory_lots il
          WHERE il.branch_product_id = bp.id
            AND il.current_quantity > 0
            AND il.status = 'active'
          ORDER BY il.expiration_date ASC, il.received_at ASC, il.id ASC
          LIMIT 1
        ) AS nearest_lot_number,
        (
          SELECT il.expiration_date
          FROM inventory_lots il
          WHERE il.branch_product_id = bp.id
            AND il.current_quantity > 0
            AND il.status = 'active'
          ORDER BY il.expiration_date ASC, il.received_at ASC, il.id ASC
          LIMIT 1
        ) AS nearest_expiration_date
      FROM branch_products bp
      JOIN branches b ON b.id = bp.branch_id
      JOIN products p ON p.id = bp.product_id
      ${whereClause}
      ORDER BY b.name ASC, p.name ASC
    `,
    values
  );

  return {
    total: rows.length,
    items: rows.map((row) => ({
      ...row,
      current_stock: toNumber(row.current_stock),
      min_stock: toNumber(row.min_stock),
    })),
  };
};

export const getInventoryMovements = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const scope = await buildInventoryScope(params, actor);
  const movementType = normalizeMovementType(params.movement_type);
  const dateFrom = normalizeDate(params.date_from, "date_from");
  const dateTo = normalizeDate(params.date_to, "date_to");

  const where = [];
  const values = [];

  appendScopeFilters(where, values, scope);

  if (movementType) {
    where.push("im.movement_type = ?");
    values.push(movementType);
  }

  if (dateFrom) {
    where.push("DATE(im.created_at) >= ?");
    values.push(dateFrom);
  }

  if (dateTo) {
    where.push("DATE(im.created_at) <= ?");
    values.push(dateTo);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `
      SELECT
        im.id AS inventory_movement_id,
        im.created_at,
        p.name AS product_name,
        CASE
          WHEN im.movement_type = 'in' THEN 'purchase'
          ELSE im.movement_type
        END AS movement_type,
        im.quantity,
        im.notes,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name
      FROM inventory_movements im
      JOIN branch_products bp ON bp.id = im.branch_product_id
      JOIN branches b ON b.id = bp.branch_id
      JOIN products p ON p.id = bp.product_id
      LEFT JOIN users u ON u.id = im.moved_by
      ${whereClause}
      ORDER BY im.created_at DESC, im.id DESC
    `,
    values
  );

  return {
    total: rows.length,
    items: rows.map((row) => ({
      ...row,
      quantity: toNumber(row.quantity),
      user_name: row.user_name || null,
    })),
  };
};
