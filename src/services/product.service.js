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

const normalizeDecimal = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed) || parsed < 0) {
    throw createHttpError(400, `${fieldName} must be a positive number`);
  }

  return parsed;
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
      "Only SUPER_ADMIN, PHARMACY_ADMIN or BRANCH_ADMIN can manage products"
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

const ensureCategoryBelongsToPharmacy = async (categoryId, pharmacyId) => {
  if (!categoryId) return;

  const [rows] = await pool.execute(
    `
      SELECT id
      FROM product_categories
      WHERE id = ? AND pharmacy_id = ?
      LIMIT 1
    `,
    [categoryId, pharmacyId]
  );

  if (rows.length === 0) {
    throw createHttpError(400, "category_id does not belong to the selected pharmacy");
  }
};

const ensureUniqueSkuInPharmacy = async (pharmacyId, sku, excludedId = null) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM products
      WHERE pharmacy_id = ? AND LOWER(sku) = LOWER(?)
      ${excludedId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    excludedId ? [pharmacyId, sku, excludedId] : [pharmacyId, sku]
  );

  if (rows.length > 0) {
    throw createHttpError(409, "SKU already exists in this pharmacy");
  }
};

const getProductById = async (id) => {
  const [rows] = await pool.execute(
    `
      SELECT
        p.id,
        p.pharmacy_id,
        ph.name AS pharmacy_name,
        p.category_id,
        c.name AS category_name,
        p.sku,
        p.barcode,
        p.name,
        p.generic_name,
        p.description,
        p.brand,
        p.pharmaceutical_form,
        p.presentation,
        p.concentration,
        p.unit_of_measure,
        p.requires_prescription,
        p.is_controlled_substance,
        p.tax_rate,
        p.status,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at
      FROM products p
      JOIN pharmacies ph ON ph.id = p.pharmacy_id
      LEFT JOIN product_categories c ON c.id = p.category_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

const assertProductAccess = (actor, product) => {
  if (actor.is_super_admin) return;

  if (Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(product.pharmacy_id, 10)) {
    throw createHttpError(403, "You can only manage products from your assigned pharmacy");
  }
};

export const createProduct = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(data.pharmacy_id, "pharmacy_id");

  const pharmacyId = actor.is_super_admin
    ? parseRequiredInt(payloadPharmacyId, "pharmacy_id")
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!actor.is_super_admin && payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
    throw createHttpError(403, "You can only create products in your assigned pharmacy");
  }

  await ensurePharmacyExists(pharmacyId);

  const categoryId = parseOptionalInt(data.category_id, "category_id");
  await ensureCategoryBelongsToPharmacy(categoryId, pharmacyId);

  const sku = normalizeRequiredString(data.sku, "sku");
  await ensureUniqueSkuInPharmacy(pharmacyId, sku);

  const payload = {
    pharmacy_id: pharmacyId,
    category_id: categoryId,
    sku,
    barcode: normalizeString(data.barcode),
    name: normalizeRequiredString(data.name, "name"),
    generic_name: normalizeString(data.generic_name),
    description: normalizeString(data.description),
    brand: normalizeString(data.brand),
    pharmaceutical_form: normalizeString(data.pharmaceutical_form),
    presentation: normalizeString(data.presentation),
    concentration: normalizeString(data.concentration),
    unit_of_measure: normalizeString(data.unit_of_measure),
    requires_prescription: normalizeBoolean(data.requires_prescription) ? 1 : 0,
    is_controlled_substance: normalizeBoolean(data.is_controlled_substance) ? 1 : 0,
    tax_rate: normalizeDecimal(data.tax_rate, "tax_rate"),
    status: normalizeStatus(data.status, true),
    created_by: actor.id,
    updated_by: actor.id,
  };

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO products (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getProductById(result.insertId);
};

export const getProductByIdForActor = async (id, actorUserId) => {
  const productId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const product = await getProductById(productId);

  if (!product) {
    throw createHttpError(404, "Product not found");
  }

  assertProductAccess(actor, product);

  return product;
};

export const getProductsByPharmacy = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");

  const pharmacyId = actor.is_super_admin
    ? parseRequiredInt(payloadPharmacyId, "pharmacy_id")
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!actor.is_super_admin && payloadPharmacyId && payloadPharmacyId !== pharmacyId) {
    throw createHttpError(403, "You can only view products from your assigned pharmacy");
  }

  await ensurePharmacyExists(pharmacyId);

  const [rows] = await pool.execute(
    `
      SELECT
        p.id,
        p.pharmacy_id,
        ph.name AS pharmacy_name,
        p.category_id,
        c.name AS category_name,
        p.sku,
        p.barcode,
        p.name,
        p.generic_name,
        p.description,
        p.brand,
        p.pharmaceutical_form,
        p.presentation,
        p.concentration,
        p.unit_of_measure,
        p.requires_prescription,
        p.is_controlled_substance,
        p.tax_rate,
        p.status,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at
      FROM products p
      JOIN pharmacies ph ON ph.id = p.pharmacy_id
      LEFT JOIN product_categories c ON c.id = p.category_id
      WHERE p.pharmacy_id = ?
      ORDER BY p.name ASC
    `,
    [pharmacyId]
  );

  return {
    pharmacy_id: pharmacyId,
    total: rows.length,
    items: rows,
  };
};

export const updateProduct = async (id, data, actorUserId) => {
  const productId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const currentProduct = await getProductById(productId);

  if (!currentProduct) {
    throw createHttpError(404, "Product not found");
  }

  assertProductAccess(actor, currentProduct);

  if (Object.prototype.hasOwnProperty.call(data, "pharmacy_id")) {
    const payloadPharmacyId = parseRequiredInt(data.pharmacy_id, "pharmacy_id");
    if (payloadPharmacyId !== Number.parseInt(currentProduct.pharmacy_id, 10)) {
      throw createHttpError(400, "Product pharmacy cannot be changed");
    }
  }

  const payload = {};
  const pharmacyId = Number.parseInt(currentProduct.pharmacy_id, 10);

  if (Object.prototype.hasOwnProperty.call(data, "category_id")) {
    const categoryId = parseOptionalInt(data.category_id, "category_id");
    await ensureCategoryBelongsToPharmacy(categoryId, pharmacyId);
    payload.category_id = categoryId;
  }

  if (Object.prototype.hasOwnProperty.call(data, "sku")) {
    const sku = normalizeRequiredString(data.sku, "sku");
    await ensureUniqueSkuInPharmacy(pharmacyId, sku, productId);
    payload.sku = sku;
  }

  if (Object.prototype.hasOwnProperty.call(data, "barcode")) {
    payload.barcode = normalizeString(data.barcode);
  }

  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = normalizeRequiredString(data.name, "name");
  }

  if (Object.prototype.hasOwnProperty.call(data, "generic_name")) {
    payload.generic_name = normalizeString(data.generic_name);
  }

  if (Object.prototype.hasOwnProperty.call(data, "description")) {
    payload.description = normalizeString(data.description);
  }

  if (Object.prototype.hasOwnProperty.call(data, "brand")) {
    payload.brand = normalizeString(data.brand);
  }

  if (Object.prototype.hasOwnProperty.call(data, "pharmaceutical_form")) {
    payload.pharmaceutical_form = normalizeString(data.pharmaceutical_form);
  }

  if (Object.prototype.hasOwnProperty.call(data, "presentation")) {
    payload.presentation = normalizeString(data.presentation);
  }

  if (Object.prototype.hasOwnProperty.call(data, "concentration")) {
    payload.concentration = normalizeString(data.concentration);
  }

  if (Object.prototype.hasOwnProperty.call(data, "unit_of_measure")) {
    payload.unit_of_measure = normalizeString(data.unit_of_measure);
  }

  if (Object.prototype.hasOwnProperty.call(data, "requires_prescription")) {
    payload.requires_prescription = normalizeBoolean(data.requires_prescription) ? 1 : 0;
  }

  if (Object.prototype.hasOwnProperty.call(data, "is_controlled_substance")) {
    payload.is_controlled_substance = normalizeBoolean(data.is_controlled_substance) ? 1 : 0;
  }

  if (Object.prototype.hasOwnProperty.call(data, "tax_rate")) {
    payload.tax_rate = normalizeDecimal(data.tax_rate, "tax_rate");
  }

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    const status = normalizeStatus(data.status, false);
    if (!status) {
      throw createHttpError(400, "status cannot be empty");
    }
    payload.status = status;
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, "No valid fields provided for update");
  }

  payload.updated_by = actor.id;

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, productId]);

  return getProductById(productId);
};
