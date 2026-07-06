import pool from "../config/database.js";

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_READ_ROLE_CODES = new Set(["PHARMACY_ADMIN", "BRANCH_ADMIN", "CASHIER"]);
const ALLOWED_MANAGE_ROLE_CODES = new Set(["PHARMACY_ADMIN", "BRANCH_ADMIN"]);

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
    throw createHttpError(400, `${fieldName} es obligatorio y debe ser un entero positivo`);
  }
  return parsed;
};

const parseOptionalInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  return parseRequiredInt(value, fieldName);
};

const normalizeNumber = (value, fieldName, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} debe ser un número positivo`);
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
    throw createHttpError(400, "Estado inválido. Valores permitidos: active, inactive");
  }

  return normalized;
};

const parseOptionalBoolean = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return undefined;

  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return Boolean(value);

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;

  throw createHttpError(400, `${fieldName} debe ser un valor booleano`);
};

const getActorContextById = async (userId, mode = "manage") => {
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
    throw createHttpError(401, "Usuario autenticado no encontrado");
  }

  if (String(actor.status).toLowerCase() !== "active") {
    throw createHttpError(403, "El usuario autenticado está inactivo");
  }

  const normalized = {
    ...actor,
    is_super_admin: normalizeBoolean(actor.is_super_admin),
    role_code: normalizeRoleCode(actor.role_code),
  };

  const allowedRoleCodes = mode === "read" ? ALLOWED_READ_ROLE_CODES : ALLOWED_MANAGE_ROLE_CODES;
  const canProceed = normalized.is_super_admin || allowedRoleCodes.has(normalized.role_code);
  if (!canProceed) {
    throw createHttpError(
      403,
      mode === "read"
        ? "Solo SUPER_ADMIN, PHARMACY_ADMIN, BRANCH_ADMIN o CASHIER pueden ver productos por sucursal"
        : "Solo SUPER_ADMIN, PHARMACY_ADMIN o BRANCH_ADMIN pueden gestionar productos por sucursal"
    );
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "El usuario no tiene una farmacia asignada");
  }

  return normalized;
};

const getActiveAssignedBranchIds = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT branch_id
      FROM user_branch_roles
      WHERE user_id = ? AND status = 'active'
      ORDER BY is_default DESC, branch_id ASC
    `,
    [userId]
  );

  return rows.map((row) => Number.parseInt(row.branch_id, 10)).filter((value) => Number.isInteger(value));
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
    throw createHttpError(400, "Sucursal no encontrada");
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
    throw createHttpError(400, "Producto no encontrado");
  }

  return rows[0];
};

const ensurePharmacyExists = async (pharmacyId) => {
  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);

  if (rows.length === 0) {
    throw createHttpError(400, "Farmacia no encontrada");
  }
};

const assertPharmacyAccess = ({ actor, pharmacyId }) => {
  if (actor.is_super_admin) return;

  const actorPharmacyId = Number.parseInt(actor.pharmacy_id, 10);
  const targetPharmacyId = Number.parseInt(pharmacyId, 10);

  if (actorPharmacyId !== targetPharmacyId) {
    throw createHttpError(403, "Solo puedes gestionar productos por sucursal de tu farmacia asignada");
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
    throw createHttpError(409, "Este producto ya está asignado a esta sucursal");
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

export const getBranchProducts = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId, "read");

  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");
  const branchId = parseOptionalInt(params.branch_id, "branch_id");
  const productId = parseOptionalInt(params.product_id, "product_id");
  const status = normalizeStatus(params.status, false);
  const search = normalizeString(params.search);
  const isVisibleInPos = parseOptionalBoolean(params.is_visible_in_pos, "is_visible_in_pos");
  const isSellable = parseOptionalBoolean(params.is_sellable, "is_sellable");
  const hasStock = parseOptionalBoolean(params.has_stock, "has_stock");
  const restrictToAssignedBranches =
    !actor.is_super_admin && (actor.role_code === "CASHIER" || actor.role_code === "BRANCH_ADMIN");
  const assignedBranchIds = restrictToAssignedBranches
    ? await getActiveAssignedBranchIds(actor.id)
    : [];

  let pharmacyId = actor.is_super_admin ? payloadPharmacyId : Number.parseInt(actor.pharmacy_id, 10);

  if (restrictToAssignedBranches && assignedBranchIds.length === 0) {
    return {
      pharmacy_id: pharmacyId,
      branch_id: branchId,
      product_id: productId,
      total: 0,
      items: [],
    };
  }

  if (payloadPharmacyId) {
    await ensurePharmacyExists(payloadPharmacyId);
    assertPharmacyAccess({ actor, pharmacyId: payloadPharmacyId });
  }

  if (branchId) {
    const branch = await getBranchById(branchId);
    assertPharmacyAccess({ actor, pharmacyId: branch.pharmacy_id });

     if (restrictToAssignedBranches && !assignedBranchIds.includes(Number.parseInt(branch.id, 10))) {
      throw createHttpError(403, "Solo puedes ver productos por sucursal de tus sucursales asignadas");
    }

    if (pharmacyId && Number.parseInt(branch.pharmacy_id, 10) !== pharmacyId) {
      throw createHttpError(400, "branch_id no pertenece a pharmacy_id");
    }

    pharmacyId = Number.parseInt(branch.pharmacy_id, 10);
  }

  if (productId) {
    const product = await getProductById(productId);
    assertPharmacyAccess({ actor, pharmacyId: product.pharmacy_id });

    if (pharmacyId && Number.parseInt(product.pharmacy_id, 10) !== pharmacyId) {
      throw createHttpError(400, "product_id no pertenece a pharmacy_id");
    }

    pharmacyId = Number.parseInt(product.pharmacy_id, 10);
  }

  const where = [];
  const values = [];

  if (pharmacyId) {
    where.push("b.pharmacy_id = ?");
    values.push(pharmacyId);
  }

  if (branchId) {
    where.push("bp.branch_id = ?");
    values.push(branchId);
  }

  if (productId) {
    where.push("bp.product_id = ?");
    values.push(productId);
  }

  if (status) {
    where.push("bp.status = ?");
    values.push(status);
  }

  if (isVisibleInPos !== undefined) {
    where.push("bp.is_visible_in_pos = ?");
    values.push(isVisibleInPos ? 1 : 0);
  }

  if (isSellable !== undefined) {
    where.push("bp.is_sellable = ?");
    values.push(isSellable ? 1 : 0);
  }

  if (hasStock !== undefined) {
    where.push(hasStock ? "bp.current_stock > 0" : "bp.current_stock <= 0");
  }

  if (restrictToAssignedBranches && !branchId) {
    where.push(`bp.branch_id IN (${assignedBranchIds.map(() => "?").join(", ")})`);
    values.push(...assignedBranchIds);
  }

  if (search) {
    where.push(
      "(LOWER(p.name) LIKE LOWER(?) OR LOWER(p.sku) LIKE LOWER(?) OR LOWER(p.barcode) LIKE LOWER(?) OR LOWER(b.name) LIKE LOWER(?))"
    );
    const searchTerm = `%${search}%`;
    values.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `
      SELECT
        bp.id,
        bp.branch_id,
        b.name AS branch_name,
        b.pharmacy_id,
        ph.name AS pharmacy_name,
        bp.product_id,
        p.name AS product_name,
        p.sku,
        p.barcode,
        p.generic_name,
        p.brand,
        p.pharmaceutical_form,
        p.presentation,
        p.concentration,
        p.unit_of_measure,
        p.tax_rate,
        p.requires_prescription,
        p.is_controlled_substance,
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
      JOIN pharmacies ph ON ph.id = b.pharmacy_id
      JOIN products p ON p.id = bp.product_id
      ${whereClause}
      ORDER BY ph.name ASC, b.name ASC, p.name ASC
    `,
    values
  );

  return {
    pharmacy_id: pharmacyId,
    branch_id: branchId,
    product_id: productId,
    total: rows.length,
    items: rows.map((row) => ({
      ...row,
      requires_prescription: normalizeBoolean(row.requires_prescription),
      is_controlled_substance: normalizeBoolean(row.is_controlled_substance),
      is_sellable: normalizeBoolean(row.is_sellable),
      is_visible_in_pos: normalizeBoolean(row.is_visible_in_pos),
    })),
  };
};

export const createBranchProduct = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);

  const branchId = parseRequiredInt(data.branch_id, "branch_id");
  const productId = parseRequiredInt(data.product_id, "product_id");
  const initialCurrentStock = normalizeNumber(data.current_stock, "current_stock", 0);
  const initialReservedStock = normalizeNumber(data.reserved_stock, "reserved_stock", 0);

  const branch = await getBranchById(branchId);
  const product = await getProductById(productId);

  if (Number.parseInt(branch.pharmacy_id, 10) !== Number.parseInt(product.pharmacy_id, 10)) {
    throw createHttpError(400, "La sucursal y el producto deben pertenecer a la misma farmacia");
  }

  assertPharmacyAccess({ actor, pharmacyId: branch.pharmacy_id });
  await ensureUniqueBranchProduct(branchId, productId);

  if (initialCurrentStock > 0) {
    throw createHttpError(
      400,
      "current_stock no puede inicializarse manualmente. Usa los endpoints de lotes de inventario para cargar stock"
    );
  }

  if (initialReservedStock > 0) {
    throw createHttpError(
      400,
      "reserved_stock no puede inicializarse manualmente cuando el producto de sucursal no tiene stock"
    );
  }

  const payload = {
    branch_id: branchId,
    product_id: productId,
    sale_price: normalizeNumber(data.sale_price, "sale_price", null),
    cost_price_default: normalizeNumber(data.cost_price_default, "cost_price_default", null),
    min_stock: normalizeNumber(data.min_stock, "min_stock", 0),
    max_stock: normalizeNumber(data.max_stock, "max_stock", 0),
    reorder_point: normalizeNumber(data.reorder_point, "reorder_point", 0),
    current_stock: 0,
    reserved_stock: 0,
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

export const updateBranchProduct = async (id, data, actorUserId) => {
  const branchProductId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const currentBranchProduct = await getBranchProductById(branchProductId);

  if (!currentBranchProduct) {
    throw createHttpError(404, "Producto de sucursal no encontrado");
  }

  assertPharmacyAccess({ actor, pharmacyId: currentBranchProduct.pharmacy_id });

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "sale_price")) {
    payload.sale_price = normalizeNumber(data.sale_price, "sale_price", null);
  }

  if (Object.prototype.hasOwnProperty.call(data, "cost_price_default")) {
    payload.cost_price_default = normalizeNumber(
      data.cost_price_default,
      "cost_price_default",
      null
    );
  }

  if (Object.prototype.hasOwnProperty.call(data, "min_stock")) {
    payload.min_stock = normalizeNumber(data.min_stock, "min_stock", 0);
  }

  if (Object.prototype.hasOwnProperty.call(data, "max_stock")) {
    payload.max_stock = normalizeNumber(data.max_stock, "max_stock", 0);
  }

  if (Object.prototype.hasOwnProperty.call(data, "reorder_point")) {
    payload.reorder_point = normalizeNumber(data.reorder_point, "reorder_point", 0);
  }

  if (Object.prototype.hasOwnProperty.call(data, "shelf_location")) {
    payload.shelf_location = normalizeString(data.shelf_location);
  }

  if (Object.prototype.hasOwnProperty.call(data, "is_sellable")) {
    payload.is_sellable = normalizeBoolean(data.is_sellable) ? 1 : 0;
  }

  if (Object.prototype.hasOwnProperty.call(data, "is_visible_in_pos")) {
    payload.is_visible_in_pos = normalizeBoolean(data.is_visible_in_pos) ? 1 : 0;
  }

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    const status = normalizeStatus(data.status, false);
    if (!status) {
      throw createHttpError(400, "El estado no puede estar vacío");
    }
    payload.status = status;
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, "No se proporcionaron campos válidos para actualizar");
  }

  payload.updated_by = actor.id;

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE branch_products SET ${setClause} WHERE id = ?`, [
    ...values,
    branchProductId,
  ]);

  return getBranchProductById(branchProductId);
};
