import pool from "../config/database.js";
import {
  findUserContextById,
  findBranchById,
  hasActiveBranchAccess,
  insertSale,
  insertSaleDetail,
  insertSaleDetailLot,
  getNextSaleSequenceForBranchToday,
  findBranchProductForUpdate,
  findAvailableLotsFefo,
  updateInventoryLotStock,
  updateBranchProductStock,
  insertInventoryMovement,
} from "../repositories/sale.repository.js";

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

const parsePositiveNumber = (value, fieldName, allowZero = false) => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw createHttpError(400, `${fieldName} must be a valid number`);
  }

  if (allowZero) {
    if (parsed < 0) {
      throw createHttpError(400, `${fieldName} must be greater than or equal to 0`);
    }
  } else if (parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be greater than 0`);
  }

  return parsed;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizePaymentStatus = (value) => {
  const normalized = normalizeString(value)?.toLowerCase() || "paid";
  const allowed = new Set(["pending", "paid", "partial", "voided"]);

  if (!allowed.has(normalized)) {
    throw createHttpError(400, "payment_status is invalid");
  }

  return normalized;
};

const buildSaleNumber = (branchId, sequence) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `V-${branchId}-${y}${m}${d}-${seq}`;
};

const normalizeSalePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "Payload must be an object");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw createHttpError(400, "items is required and must contain at least one item");
  }

  const items = payload.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createHttpError(400, `items[${index}] must be an object`);
    }

    const quantity = parsePositiveNumber(item.quantity, `items[${index}].quantity`, false);
    const unitPrice = parsePositiveNumber(item.unit_price, `items[${index}].unit_price`, true);
    const discountAmount = parsePositiveNumber(
      item.discount_amount ?? 0,
      `items[${index}].discount_amount`,
      true
    );

    const lineSubtotal = quantity * unitPrice;
    if (discountAmount > lineSubtotal) {
      throw createHttpError(
        400,
        `items[${index}].discount_amount cannot be greater than line subtotal`
      );
    }

    return {
      branch_product_id: parseRequiredInt(item.branch_product_id, `items[${index}].branch_product_id`),
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      line_subtotal: lineSubtotal,
      line_net: lineSubtotal - discountAmount,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.line_subtotal, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);

  return {
    branch_id: parseRequiredInt(payload.branch_id, "branch_id"),
    customer_name: normalizeString(payload.customer_name),
    customer_document: normalizeString(payload.customer_document),
    payment_status: normalizePaymentStatus(payload.payment_status),
    notes: normalizeString(payload.notes),
    items,
    subtotal,
    total_discount: totalDiscount,
  };
};

const getActorContext = async (connection, actorUserId) => {
  const actor = await findUserContextById(connection, actorUserId);

  if (!actor) {
    throw createHttpError(401, "Authenticated user not found");
  }

  if (String(actor.status).toLowerCase() !== "active") {
    throw createHttpError(403, "Authenticated user is inactive");
  }

  return {
    ...actor,
    is_super_admin: normalizeBoolean(actor.is_super_admin),
    role_code: normalizeRoleCode(actor.role_code),
  };
};

const assertUserCanOperateBranch = async (connection, actor, branch) => {
  if (actor.is_super_admin) return;

  if (!actor.pharmacy_id || Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(branch.pharmacy_id, 10)) {
    throw createHttpError(403, "User cannot operate this branch");
  }

  if (actor.role_code === "CASHIER" || actor.role_code === "BRANCH_ADMIN") {
    const hasAccess = await hasActiveBranchAccess(connection, actor.id, branch.id);
    if (!hasAccess) {
      throw createHttpError(403, "User has no access to this branch");
    }
  }
};

export const createSale = async (payload, actorUserId) => {
  const normalized = normalizeSalePayload(payload);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const actor = await getActorContext(connection, actorUserId);
    const branch = await findBranchById(connection, normalized.branch_id);

    if (!branch) {
      throw createHttpError(400, "branch_id does not exist");
    }

    await assertUserCanOperateBranch(connection, actor, branch);

    const sequence = await getNextSaleSequenceForBranchToday(connection, normalized.branch_id);
    const saleNumber = buildSaleNumber(normalized.branch_id, sequence);

    let taxTotal = 0;
    for (const item of normalized.items) {
      const branchProduct = await findBranchProductForUpdate(connection, item.branch_product_id);
      if (!branchProduct) {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} does not exist`);
      }
      const taxRate = Number.parseFloat(branchProduct.tax_rate || 0);
      const lineTax = (item.line_net * taxRate) / 100;
      item.tax_rate = taxRate;
      item.tax_amount = lineTax;
      item.line_total = item.line_net + lineTax;
      taxTotal += lineTax;
    }

    const grandTotal = normalized.subtotal - normalized.total_discount + taxTotal;

    const saleId = await insertSale(connection, {
      pharmacy_id: branch.pharmacy_id,
      branch_id: normalized.branch_id,
      cashier_user_id: actor.id,
      sale_number: saleNumber,
      customer_name: normalized.customer_name,
      customer_document: normalized.customer_document,
      subtotal: normalized.subtotal,
      discount_amount: normalized.total_discount,
      tax_amount: taxTotal,
      total: grandTotal,
      payment_status: normalized.payment_status,
      sale_status: "completed",
      notes: normalized.notes,
    });

    for (const item of normalized.items) {
      const branchProduct = await findBranchProductForUpdate(connection, item.branch_product_id);

      if (!branchProduct) {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} does not exist`);
      }

      if (Number.parseInt(branchProduct.branch_id, 10) !== normalized.branch_id) {
        throw createHttpError(
          400,
          `branch_product_id ${item.branch_product_id} does not belong to branch ${normalized.branch_id}`
        );
      }

      if (String(branchProduct.status).toLowerCase() !== "active") {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} is not active`);
      }

      const lots = await findAvailableLotsFefo(connection, item.branch_product_id);
      const availableStock = lots.reduce(
        (sum, lot) => sum + Number.parseFloat(lot.current_quantity || 0),
        0
      );

      if (availableStock < item.quantity) {
        throw createHttpError(
          400,
          `Insufficient stock for branch_product_id ${item.branch_product_id}. Available: ${availableStock}, Requested: ${item.quantity}`
        );
      }

      const saleDetailId = await insertSaleDetail(connection, {
        sale_id: saleId,
        branch_product_id: item.branch_product_id,
        product_id: branchProduct.product_id,
        product_name: branchProduct.product_name,
        sku: branchProduct.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        requires_prescription: normalizeBoolean(branchProduct.requires_prescription) ? 1 : 0,
      });

      let remainingQuantity = item.quantity;
      let runningPreviousStock = Number.parseFloat(branchProduct.current_stock || 0);

      for (const lot of lots) {
        if (remainingQuantity <= 0) break;

        const lotCurrentQuantity = Number.parseFloat(lot.current_quantity || 0);
        if (lotCurrentQuantity <= 0) continue;

        const consumedQuantity = Math.min(remainingQuantity, lotCurrentQuantity);
        const lotNewQuantity = lotCurrentQuantity - consumedQuantity;

        await updateInventoryLotStock(connection, lot.id, lotNewQuantity, actor.id);

        await insertSaleDetailLot(connection, {
          sale_detail_id: saleDetailId,
          inventory_lot_id: lot.id,
          quantity: consumedQuantity,
          unit_cost: lot.purchase_price,
          expiration_date: lot.expiration_date,
        });

        const runningNewStock = runningPreviousStock - consumedQuantity;
        await insertInventoryMovement(connection, {
          branch_product_id: item.branch_product_id,
          inventory_lot_id: lot.id,
          movement_type: "sale",
          reference_type: "sale",
          reference_id: saleId,
          quantity: -consumedQuantity,
          previous_stock: runningPreviousStock,
          new_stock: runningNewStock,
          unit_price: item.unit_price,
          notes: `Venta #${saleId}`,
          moved_by: actor.id,
        });

        runningPreviousStock = runningNewStock;
        remainingQuantity -= consumedQuantity;
      }

      await updateBranchProductStock(connection, item.branch_product_id, runningPreviousStock, actor.id);
    }

    await connection.commit();

    return {
      sale_id: saleId,
      sale_number: saleNumber,
      branch_id: normalized.branch_id,
      tax_amount: taxTotal,
      subtotal: normalized.subtotal,
      discount_total: normalized.total_discount,
      total_amount: grandTotal,
      items_count: normalized.items.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
