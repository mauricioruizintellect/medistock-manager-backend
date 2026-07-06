import pool from "../config/database.js";
import {
  findActorById,
  findBranchProductById,
  findLotByBranchProductAndLotNumber,
  getBranchProductLotStock,
  insertInventoryLot,
  insertInventoryMovement,
  updateBranchProductCurrentStock,
} from "../repositories/inventory-lot.repository.js";

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

const parseRequiredInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} es obligatorio y debe ser un entero positivo`);
  }
  return parsed;
};

const parsePositiveNumber = (value, fieldName, allowZero = true) => {
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    throw createHttpError(400, `${fieldName} debe ser un número válido`);
  }

  if (allowZero) {
    if (parsed < 0) {
      throw createHttpError(400, `${fieldName} debe ser mayor o igual a 0`);
    }
  } else if (parsed <= 0) {
    throw createHttpError(400, `${fieldName} debe ser mayor que 0`);
  }

  return parsed;
};

const parseExpirationDate = (value) => {
  if (!value) {
    throw createHttpError(400, "expiration_date es obligatorio");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, "expiration_date es inválido");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (date <= today) {
    throw createHttpError(400, "expiration_date debe ser mayor a la fecha actual");
  }

  return value;
};

const getActorContext = async (connection, actorUserId) => {
  const actor = await findActorById(connection, actorUserId);

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

  const canManage = normalized.is_super_admin || ALLOWED_ROLE_CODES.has(normalized.role_code);
  if (!canManage) {
    throw createHttpError(
      403,
      "Solo SUPER_ADMIN, PHARMACY_ADMIN o BRANCH_ADMIN pueden gestionar lotes de inventario"
    );
  }

  if (!normalized.is_super_admin && !normalized.pharmacy_id) {
    throw createHttpError(403, "El usuario no tiene una farmacia asignada");
  }

  return normalized;
};

const normalizeItem = (rawItem, index) => {
  if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
    throw createHttpError(400, `El elemento en la posición ${index} debe ser un objeto`);
  }

  const branchProductId = parseRequiredInt(rawItem.branch_product_id, "branch_product_id");
  const lotNumber = normalizeString(rawItem.lot_number);
  if (!lotNumber) {
    throw createHttpError(400, "lot_number es obligatorio");
  }

  const initialQuantity = parsePositiveNumber(rawItem.initial_quantity, "initial_quantity", false);
  const currentQuantity = parsePositiveNumber(rawItem.current_quantity, "current_quantity", true);

  if (currentQuantity !== initialQuantity) {
    throw createHttpError(400, "current_quantity debe ser igual a initial_quantity");
  }

  return {
    branch_product_id: branchProductId,
    lot_number: lotNumber,
    expiration_date: parseExpirationDate(rawItem.expiration_date),
    purchase_price: parsePositiveNumber(rawItem.purchase_price, "purchase_price", true),
    initial_quantity: initialQuantity,
    current_quantity: currentQuantity,
    received_at: rawItem.received_at || undefined,
    supplier_name: normalizeString(rawItem.supplier_name),
    invoice_reference: normalizeString(rawItem.invoice_reference),
    status: rawItem.status || undefined,
  };
};

const normalizeReceiveItem = (rawItem, index) => {
  if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
    throw createHttpError(400, `El elemento en la posición ${index} debe ser un objeto`);
  }

  const branchProductId = parseRequiredInt(rawItem.branch_product_id, "branch_product_id");
  const lotNumber = normalizeString(rawItem.lot_number);
  if (!lotNumber) {
    throw createHttpError(400, "lot_number es obligatorio");
  }

  const quantity = parsePositiveNumber(rawItem.quantity, "quantity", false);

  return {
    branch_product_id: branchProductId,
    lot_number: lotNumber,
    expiration_date: parseExpirationDate(rawItem.expiration_date),
    purchase_price: parsePositiveNumber(rawItem.purchase_price, "purchase_price", true),
    initial_quantity: quantity,
    current_quantity: quantity,
    received_at: rawItem.received_at || undefined,
    supplier_name: normalizeString(rawItem.supplier_name),
    invoice_reference: normalizeString(rawItem.invoice_reference),
    status: rawItem.status || undefined,
    notes: normalizeString(rawItem.notes),
  };
};

const normalizePayload = (payload) => {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw createHttpError(400, "El arreglo del payload no puede estar vacío");
    }

    return {
      isBulk: true,
      items: payload.map((item, index) => normalizeItem(item, index)),
    };
  }

  return {
    isBulk: false,
    items: [normalizeItem(payload, 0)],
  };
};

const normalizeReceivePayload = (payload) => {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw createHttpError(400, "El arreglo del payload no puede estar vacío");
    }

    return {
      isBulk: true,
      items: payload.map((item, index) => normalizeReceiveItem(item, index)),
    };
  }

  return {
    isBulk: false,
    items: [normalizeReceiveItem(payload, 0)],
  };
};

const buildInventoryLotPayload = (item, actorUserId) => {
  const payload = {
    branch_product_id: item.branch_product_id,
    lot_number: item.lot_number,
    expiration_date: item.expiration_date,
    purchase_price: item.purchase_price,
    initial_quantity: item.initial_quantity,
    current_quantity: item.current_quantity,
    supplier_name: item.supplier_name,
    invoice_reference: item.invoice_reference,
    created_by: actorUserId,
    updated_by: actorUserId,
  };

  if (item.received_at) payload.received_at = item.received_at;
  if (item.status) payload.status = item.status;

  return payload;
};

const assertCanManageBranchProductInventory = (actor, branchProduct) => {
  if (actor.is_super_admin) return;

  if (
    Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(branchProduct.pharmacy_id, 10)
  ) {
    throw createHttpError(
      403,
      `Solo puedes cargar inventario para tu farmacia asignada (branch_product_id ${branchProduct.id})`
    );
  }
};

export const initialLoadInventoryLots = async (payload, actorUserId) => {
  const normalized = normalizePayload(payload);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const actor = await getActorContext(connection, actorUserId);
    const createdItems = [];

    for (const item of normalized.items) {
      const branchProduct = await findBranchProductById(connection, item.branch_product_id);

      if (!branchProduct) {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} no existe`);
      }

      assertCanManageBranchProductInventory(actor, branchProduct);

      const duplicateLot = await findLotByBranchProductAndLotNumber(
        connection,
        item.branch_product_id,
        item.lot_number
      );

      if (duplicateLot) {
        throw createHttpError(
          409,
          `lot_number '${item.lot_number}' ya existe para branch_product_id ${item.branch_product_id}`
        );
      }

      const previousStock = await getBranchProductLotStock(connection, item.branch_product_id);

      const inventoryLotId = await insertInventoryLot(
        connection,
        buildInventoryLotPayload(item, actor.id)
      );

      const newStock = await getBranchProductLotStock(connection, item.branch_product_id);

      await updateBranchProductCurrentStock(connection, item.branch_product_id, newStock, actor.id);

      await insertInventoryMovement(connection, {
        branch_product_id: item.branch_product_id,
        inventory_lot_id: inventoryLotId,
        movement_type: "initial_load",
        reference_type: "system",
        quantity: item.initial_quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: item.purchase_price,
        notes: "Carga inicial de inventario",
        moved_by: actor.id,
      });

      createdItems.push({
        inventory_lot_id: inventoryLotId,
        branch_product_id: item.branch_product_id,
        lot_number: item.lot_number,
        quantity_loaded: item.initial_quantity,
      });
    }

    await connection.commit();

    return {
      mode: normalized.isBulk ? "bulk" : "single",
      total_processed: createdItems.length,
      items: createdItems,
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY" && !error.status) {
      throw createHttpError(409, "Se detectó un registro duplicado al procesar la carga inicial");
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const receiveInventoryLots = async (payload, actorUserId) => {
  const normalized = normalizeReceivePayload(payload);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const actor = await getActorContext(connection, actorUserId);
    const createdItems = [];

    for (const item of normalized.items) {
      const branchProduct = await findBranchProductById(connection, item.branch_product_id);

      if (!branchProduct) {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} no existe`);
      }

      assertCanManageBranchProductInventory(actor, branchProduct);

      const duplicateLot = await findLotByBranchProductAndLotNumber(
        connection,
        item.branch_product_id,
        item.lot_number
      );

      if (duplicateLot) {
        throw createHttpError(
          409,
          `lot_number '${item.lot_number}' ya existe para branch_product_id ${item.branch_product_id}`
        );
      }

      const previousStock = await getBranchProductLotStock(connection, item.branch_product_id);

      const inventoryLotId = await insertInventoryLot(
        connection,
        buildInventoryLotPayload(item, actor.id)
      );

      const newStock = await getBranchProductLotStock(connection, item.branch_product_id);

      await updateBranchProductCurrentStock(connection, item.branch_product_id, newStock, actor.id);

      await insertInventoryMovement(connection, {
        branch_product_id: item.branch_product_id,
        inventory_lot_id: inventoryLotId,
        movement_type: "in",
        reference_type: "invoice",
        quantity: item.initial_quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: item.purchase_price,
        notes: item.notes || "Ingreso de nuevo lote",
        moved_by: actor.id,
      });

      createdItems.push({
        inventory_lot_id: inventoryLotId,
        branch_product_id: item.branch_product_id,
        lot_number: item.lot_number,
        quantity_received: item.initial_quantity,
      });
    }

    await connection.commit();

    return {
      mode: normalized.isBulk ? "bulk" : "single",
      total_processed: createdItems.length,
      items: createdItems,
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY" && !error.status) {
      throw createHttpError(409, "Se detectó un registro duplicado al recibir lotes de inventario");
    }

    throw error;
  } finally {
    connection.release();
  }
};
