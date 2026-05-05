import pool from "../config/database.js";

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_ROLE_CODES = new Set(["PHARMACY_ADMIN", "BRANCH_ADMIN", "CASHIER"]);

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
    throw createHttpError(400, "email is required");
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

const parseOptionalLimit = (value) => {
  if (value === undefined || value === null || value === "") return 25;
  const parsed = parseRequiredInt(value, "limit");
  return Math.min(parsed, 100);
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

  const normalizedActor = {
    ...actor,
    is_super_admin: normalizeBoolean(actor.is_super_admin),
    role_code: normalizeRoleCode(actor.role_code),
  };

  const canManageClients =
    normalizedActor.is_super_admin || ALLOWED_ROLE_CODES.has(normalizedActor.role_code);

  if (!canManageClients) {
    throw createHttpError(
      403,
      "Only SUPER_ADMIN, PHARMACY_ADMIN, BRANCH_ADMIN or CASHIER can manage clients"
    );
  }

  if (!normalizedActor.is_super_admin && !normalizedActor.pharmacy_id) {
    throw createHttpError(403, "User has no assigned pharmacy");
  }

  return normalizedActor;
};

const ensurePharmacyExists = async (pharmacyId) => {
  const [rows] = await pool.execute("SELECT id FROM pharmacies WHERE id = ? LIMIT 1", [pharmacyId]);

  if (rows.length === 0) {
    throw createHttpError(400, "Pharmacy not found");
  }
};

const assertPharmacyAccess = (actor, pharmacyId) => {
  if (actor.is_super_admin) return;

  if (Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(pharmacyId, 10)) {
    throw createHttpError(403, "You can only manage clients in your assigned pharmacy");
  }
};

const buildClientSearchClause = (search) => {
  if (!search) {
    return {
      sql: "",
      values: [],
    };
  }

  const searchTerm = `%${search}%`;
  return {
    sql: `
      AND (
        LOWER(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')))) LIKE LOWER(?)
        OR LOWER(c.first_name) LIKE LOWER(?)
        OR LOWER(COALESCE(c.last_name, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(c.document_number, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(c.phone, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(c.email, '')) LIKE LOWER(?)
      )
    `,
    values: [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
  };
};

const mapClientRow = (row) => ({
  ...row,
  full_name: row.full_name?.trim() || row.first_name,
  total_purchases: Number.parseInt(row.total_purchases || 0, 10),
});

const getClientResponseById = async (clientId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        c.id,
        c.pharmacy_id,
        p.name AS pharmacy_name,
        c.first_name,
        c.last_name,
        TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, ''))) AS full_name,
        c.document_number,
        c.phone,
        c.email,
        c.address,
        c.notes,
        c.status,
        c.created_by,
        c.updated_by,
        c.created_at,
        c.updated_at,
        COALESCE(s.total_purchases, 0) AS total_purchases,
        s.last_purchase_at
      FROM clients c
      JOIN pharmacies p ON p.id = c.pharmacy_id
      LEFT JOIN (
        SELECT
          client_id,
          COUNT(*) AS total_purchases,
          MAX(created_at) AS last_purchase_at
        FROM sales
        WHERE client_id IS NOT NULL AND sale_status = 'completed'
        GROUP BY client_id
      ) s ON s.client_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `,
    [clientId]
  );

  if (!rows[0]) {
    throw createHttpError(404, "Client not found");
  }

  return mapClientRow(rows[0]);
};

const getClientRecordById = async (clientId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        pharmacy_id,
        first_name,
        last_name,
        document_number,
        phone,
        email,
        address,
        notes,
        status
      FROM clients
      WHERE id = ?
      LIMIT 1
    `,
    [clientId]
  );

  return rows[0] || null;
};

const ensureUniqueClientIdentity = async ({ pharmacyId, documentNumber, email, excludedId = null }) => {
  if (documentNumber) {
    const [rows] = await pool.execute(
      `
        SELECT id
        FROM clients
        WHERE pharmacy_id = ? AND document_number = ?
        ${excludedId ? "AND id <> ?" : ""}
        LIMIT 1
      `,
      excludedId ? [pharmacyId, documentNumber, excludedId] : [pharmacyId, documentNumber]
    );

    if (rows.length > 0) {
      throw createHttpError(409, "A client with that document number already exists in this pharmacy");
    }
  }

  if (email) {
    const [rows] = await pool.execute(
      `
        SELECT id
        FROM clients
        WHERE pharmacy_id = ? AND email = ?
        ${excludedId ? "AND id <> ?" : ""}
        LIMIT 1
      `,
      excludedId ? [pharmacyId, email, excludedId] : [pharmacyId, email]
    );

    if (rows.length > 0) {
      throw createHttpError(409, "A client with that email already exists in this pharmacy");
    }
  }
};

const buildCreatePayload = async (data, actor) => {
  const payloadPharmacyId = parseOptionalInt(data.pharmacy_id, "pharmacy_id");
  const pharmacyId = actor.is_super_admin
    ? payloadPharmacyId
    : Number.parseInt(actor.pharmacy_id, 10);

  if (!pharmacyId) {
    throw createHttpError(400, "pharmacy_id is required");
  }

  await ensurePharmacyExists(pharmacyId);
  assertPharmacyAccess(actor, pharmacyId);

  const payload = {
    pharmacy_id: pharmacyId,
    first_name: normalizeRequiredString(data.first_name, "first_name"),
    last_name: normalizeString(data.last_name),
    document_number: normalizeString(data.document_number),
    phone: normalizeString(data.phone),
    email: normalizeEmail(data.email),
    address: normalizeString(data.address),
    notes: normalizeString(data.notes),
    status: normalizeStatus(data.status, true),
    created_by: actor.id,
    updated_by: actor.id,
  };

  await ensureUniqueClientIdentity({
    pharmacyId: pharmacyId,
    documentNumber: payload.document_number,
    email: payload.email,
  });

  return payload;
};

export const getClients = async (params, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payloadPharmacyId = parseOptionalInt(params.pharmacy_id, "pharmacy_id");
  const pharmacyId = actor.is_super_admin
    ? payloadPharmacyId
    : Number.parseInt(actor.pharmacy_id, 10);
  const status = normalizeStatus(params.status, false);
  const search = normalizeString(params.search);
  const limit = parseOptionalLimit(params.limit);

  if (!pharmacyId) {
    throw createHttpError(400, "pharmacy_id is required");
  }

  await ensurePharmacyExists(pharmacyId);
  assertPharmacyAccess(actor, pharmacyId);

  const where = ["c.pharmacy_id = ?"];
  const values = [pharmacyId];

  if (status) {
    where.push("c.status = ?");
    values.push(status);
  }

  const searchClause = buildClientSearchClause(search);
  values.push(...searchClause.values);

  const [rows] = await pool.execute(
    `
      SELECT
        c.id,
        c.pharmacy_id,
        p.name AS pharmacy_name,
        c.first_name,
        c.last_name,
        TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, ''))) AS full_name,
        c.document_number,
        c.phone,
        c.email,
        c.address,
        c.notes,
        c.status,
        c.created_by,
        c.updated_by,
        c.created_at,
        c.updated_at,
        COALESCE(s.total_purchases, 0) AS total_purchases,
        s.last_purchase_at
      FROM clients c
      JOIN pharmacies p ON p.id = c.pharmacy_id
      LEFT JOIN (
        SELECT
          client_id,
          COUNT(*) AS total_purchases,
          MAX(created_at) AS last_purchase_at
        FROM sales
        WHERE client_id IS NOT NULL AND sale_status = 'completed'
        GROUP BY client_id
      ) s ON s.client_id = c.id
      WHERE ${where.join(" AND ")}
      ${searchClause.sql}
      ORDER BY c.first_name ASC, c.last_name ASC, c.id ASC
      LIMIT ?
    `,
    [...values, limit]
  );

  return {
    pharmacy_id: pharmacyId,
    total: rows.length,
    items: rows.map(mapClientRow),
  };
};

export const getClientById = async (id, actorUserId) => {
  const clientId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const client = await getClientResponseById(clientId);

  assertPharmacyAccess(actor, client.pharmacy_id);

  return client;
};

export const createClient = async (data, actorUserId) => {
  const actor = await getActorContextById(actorUserId);
  const payload = await buildCreatePayload(data, actor);

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO clients (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getClientResponseById(result.insertId);
};

export const updateClient = async (id, data, actorUserId) => {
  const clientId = parseRequiredInt(id, "id");
  const actor = await getActorContextById(actorUserId);
  const currentClient = await getClientRecordById(clientId);

  if (!currentClient) {
    throw createHttpError(404, "Client not found");
  }

  assertPharmacyAccess(actor, currentClient.pharmacy_id);

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "first_name")) {
    payload.first_name = normalizeRequiredString(data.first_name, "first_name");
  }

  if (Object.prototype.hasOwnProperty.call(data, "last_name")) {
    payload.last_name = normalizeString(data.last_name);
  }

  if (Object.prototype.hasOwnProperty.call(data, "document_number")) {
    payload.document_number = normalizeString(data.document_number);
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

  if (Object.prototype.hasOwnProperty.call(data, "notes")) {
    payload.notes = normalizeString(data.notes);
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

  const nextDocumentNumber =
    Object.prototype.hasOwnProperty.call(payload, "document_number")
      ? payload.document_number
      : currentClient.document_number;
  const nextEmail = Object.prototype.hasOwnProperty.call(payload, "email")
    ? payload.email
    : currentClient.email;

  await ensureUniqueClientIdentity({
    pharmacyId: currentClient.pharmacy_id,
    documentNumber: nextDocumentNumber,
    email: nextEmail,
    excludedId: clientId,
  });

  payload.updated_by = actor.id;

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE clients SET ${setClause} WHERE id = ?`, [...values, clientId]);

  return getClientResponseById(clientId);
};
