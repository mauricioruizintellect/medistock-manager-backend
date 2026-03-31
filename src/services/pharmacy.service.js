import pool from "../config/database.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const ALLOWED_STATUS = new Set(["active", "inactive"]);

const normalizeStringField = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizeName = (value, isRequired = false) => {
  const normalized = normalizeStringField(value);

  if (isRequired && !normalized) {
    throw createHttpError(400, "Pharmacy name is required");
  }

  return normalized;
};

const normalizeStatus = (value, isRequired = false) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (isRequired) return "active";
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!ALLOWED_STATUS.has(normalized)) {
    throw createHttpError(400, "Invalid status. Allowed values: active, inactive");
  }

  return normalized;
};

const normalizeActorUserId = (actorUserId) => {
  const normalized = Number.parseInt(actorUserId, 10);

  if (Number.isNaN(normalized) || normalized <= 0) {
    throw createHttpError(401, "Invalid authenticated user");
  }

  return normalized;
};

const buildCreatePayload = (data, actorUserId) => {
  const normalizedActorUserId = normalizeActorUserId(actorUserId);

  return {
    name: normalizeName(data.name, true),
    legal_name: normalizeStringField(data.legal_name),
    tax_id: normalizeStringField(data.tax_id),
    phone: normalizeStringField(data.phone),
    email: normalizeStringField(data.email),
    address: normalizeStringField(data.address),
    city: normalizeStringField(data.city),
    country: normalizeStringField(data.country),
    status: normalizeStatus(data.status, true),
    created_by: normalizedActorUserId,
    updated_by: normalizedActorUserId,
  };
};

const buildUpdatePayload = (data) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    const name = normalizeName(data.name, false);
    if (!name) {
      throw createHttpError(400, "Pharmacy name cannot be empty");
    }
    payload.name = name;
  }

  const optionalFields = ["legal_name", "tax_id", "phone", "email", "address", "city", "country"];
  optionalFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = normalizeStringField(data[field]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(data, "status")) {
    payload.status = normalizeStatus(data.status, false);
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, "No valid fields provided for update");
  }

  return payload;
};

export const getPharmacyById = async (pharmacyId) => {
  const pharmacyIdNumber = Number.parseInt(pharmacyId, 10);

  if (Number.isNaN(pharmacyIdNumber) || pharmacyIdNumber <= 0) {
    throw createHttpError(400, "Invalid pharmacy id");
  }

  const [rows] = await pool.execute(
    `
      SELECT
        p.id,
        p.name,
        p.legal_name,
        p.tax_id,
        p.phone,
        p.email,
        p.address,
        p.city,
        p.country,
        p.status,
        p.created_by,
        CONCAT(creator.first_name, ' ', creator.last_name) AS created_by_name,
        p.updated_by,
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
        p.created_at,
        p.updated_at
      FROM pharmacies p
      LEFT JOIN users creator ON creator.id = p.created_by
      LEFT JOIN users updater ON updater.id = p.updated_by
      WHERE p.id = ?
      LIMIT 1
    `,
    [pharmacyIdNumber]
  );

  return rows[0] || null;
};

const ensureUniqueName = async (name, currentId = null) => {
  if (!name) return;

  const [existingRows] = await pool.execute(
    `
      SELECT id
      FROM pharmacies
      WHERE LOWER(name) = LOWER(?)
      ${currentId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    currentId ? [name, currentId] : [name]
  );

  if (existingRows.length > 0) {
    throw createHttpError(409, "Pharmacy already exists");
  }
};

export const createPharmacy = async (data) => {
  const payload = buildCreatePayload(data, data.actorUserId);
  await ensureUniqueName(payload.name);

  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await pool.execute(
    `INSERT INTO pharmacies (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return getPharmacyById(result.insertId);
};

export const updatePharmacy = async (pharmacyId, data) => {
  const pharmacyIdNumber = Number.parseInt(pharmacyId, 10);

  if (Number.isNaN(pharmacyIdNumber) || pharmacyIdNumber <= 0) {
    throw createHttpError(400, "Invalid pharmacy id");
  }

  const currentPharmacy = await getPharmacyById(pharmacyIdNumber);
  if (!currentPharmacy) {
    throw createHttpError(404, "Pharmacy not found");
  }

  const payload = buildUpdatePayload(data);
  payload.updated_by = normalizeActorUserId(data.actorUserId);
  await ensureUniqueName(payload.name, pharmacyIdNumber);

  const fields = Object.keys(payload);
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => payload[field]);

  await pool.execute(`UPDATE pharmacies SET ${setClause} WHERE id = ?`, [
    ...values,
    pharmacyIdNumber,
  ]);

  return getPharmacyById(pharmacyIdNumber);
};
