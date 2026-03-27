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

const parseRequiredInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} is required and must be a positive integer`);
  }
  return parsed;
};

const normalizeNumber = (value, fieldName, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} must be a positive number`);
  }

  return parsed;
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
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
      "Only SUPER_ADMIN, PHARMACY_ADMIN or BRANCH_ADMIN can manage branch products"
    );
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "User has no assigned pharmacy");
  }

  return normalized;
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

const getProductById = async (productId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, pharmacy_id, status
      FROM products
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  if (!rows[0]) {
    throw createHttpError(400, "Product not found");
  }

  return rows[0];
};

const assertPharmacyAccess = ({ actor, pharmacyId }) => {
  if (actor.is_super_admin) return;

  const actorPharmacyId = Number.parseInt(actor.pharmacy_id, 10);
  const targetPharmacyId = Number.parseInt(pharmacyId, 10);

  if (actorPharmacyId !== targetPharmacyId) {
    throw createHttpError(403, "You can only manage branch products in your assigned pharmacy");
  }
};

const ensureUniqueBranchProduct = async (branchId, productId) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM branch_products
      WHERE branch_id = ? AND product_id = ?
      LIMIT 1
    `,
    [branchId, productId]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "This product is already assigned to this branch");
  }
};

const getBranchProductById = async (id) => {
  const [rows] = await pool.execute(
    `
      SELECT
        bp.id,
        bp.branch_id,
        b.name AS branch_name,
        b.pharmacy_id,
        bp.product_id,
        p.name AS product_name,
        p.sku,
        bp.sale_price,
        bp.cost_price_default,
        bp.min_stock,
        bp.max_stock,
        bp.reorder_point,
        bp.current_stock,
        bp.reserved_stock,
        bp.shelf_location,
        bp.is_sellable,
        bp.is_visible_in_pos,
        bp.status,
        bp.created_by,
        bp.updated_by,
        bp.created_at,
        bp.updated_at
      FROM branch_products bp
      JOIN branches b ON b.id = bp.branch_id
      JOIN products p ON p.id = bp.product_id
      WHERE bp.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

export const createBranchProduct = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);

  const branchId = parseRequiredInt(data.branch_id, "branch_id");
  const productId = parseRequiredInt(data.product_id, "product_id");

  const branch = await getBranchById(branchId);
  const product = await getProductById(productId);

  if (Number.parseInt(branch.pharmacy_id, 10) !== Number.parseInt(product.pharmacy_id, 10)) {
    throw createHttpError(400, "Branch and product must belong to the same pharmacy");
  }

  assertPharmacyAccess({ actor, pharmacyId: branch.pharmacy_id });
  await ensureUniqueBranchProduct(branchId, productId);

  const payload = {
    branch_id: branchId,
    product_id: productId,
    sale_price: normalizeNumber(data.sale_price, "sale_price", null),
    cost_price_default: normalizeNumber(data.cost_price_default, "cost_price_default", null),
    min_stock: normalizeNumber(data.min_stock, "min_stock", 0),
    max_stock: normalizeNumber(data.max_stock, "max_stock", 0),
    reorder_point: normalizeNumber(data.reorder_point, "reorder_point", 0),
    current_stock: normalizeNumber(data.current_stock, "current_stock", 0),
    reserved_stock: normalizeNumber(data.reserved_stock, "reserved_stock", 0),
    shelf_location: normalizeString(data.shelf_location),
    is_sellable: normalizeBoolean(data.is_sellable) ? 1 : 0,
    is_visible_in_pos: normalizeBoolean(data.is_visible_in_pos) ? 1 : 0,
    status: normalizeStatus(data.status, true),
    created_by: actor.id,
    updated_by: actor.id,
  };

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO branch_products (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getBranchProductById(result.insertId);
};
