import pool from "../config/database.js";
import {
  findUserContextById,
  findBranchById,
  hasActiveBranchAccess,
  findClientById,
  insertSale,
  insertSaleDetail,
  insertSaleDetailLot,
  getNextSaleSequenceForBranchToday,
  findBranchProductForUpdate,
  findAvailableLotsFefo,
  updateInventoryLotStock,
  updateBranchProductStock,
  insertInventoryMovement,
  findSaleById,
  findSaleItemsBySaleId,
} from "../repositories/sale.repository.js";

const ALLOWED_PAYMENT_METHODS = new Set(["cash", "card", "transfer"]);
const ALLOWED_PAYMENT_STATUSES = new Set(["pending", "paid", "partial", "voided"]);
const ALLOWED_DISCOUNT_TYPES = new Set(["percentage", "amount"]);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";
const normalizeRoleCode = (value) => (value ? String(value).toUpperCase() : null);
const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const toNumber = (value) => roundCurrency(Number.parseFloat(value || 0));

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

const normalizePaymentMethod = (value) => {
  const normalized = normalizeString(value)?.toLowerCase() || "cash";
  if (!ALLOWED_PAYMENT_METHODS.has(normalized)) {
    throw createHttpError(400, "payment_method is invalid");
  }
  return normalized;
};

const normalizePaymentStatus = (value) => {
  const normalized = normalizeString(value)?.toLowerCase() || "paid";
  if (!ALLOWED_PAYMENT_STATUSES.has(normalized)) {
    throw createHttpError(400, "payment_status is invalid");
  }
  return normalized;
};

const normalizeDiscountType = (value, discountValue) => {
  const normalized = normalizeString(value)?.toLowerCase() || null;

  if (!normalized) {
    return discountValue > 0 ? "amount" : null;
  }

  if (!ALLOWED_DISCOUNT_TYPES.has(normalized)) {
    throw createHttpError(400, "discount_type is invalid");
  }

  return normalized;
};

const buildSaleNumber = (branchId, sequence) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `POS-${branchId}-${y}${m}${d}-${seq}`;
};

const calculateGlobalDiscountAmount = (discountType, discountValue, baseAmount) => {
  if (!discountType || discountValue <= 0) {
    return 0;
  }

  if (discountType === "percentage") {
    if (discountValue > 100) {
      throw createHttpError(400, "discount_value cannot be greater than 100 for percentage discounts");
    }

    return roundCurrency((baseAmount * discountValue) / 100);
  }

  if (discountValue > baseAmount) {
    throw createHttpError(400, "discount_value cannot be greater than the sale subtotal");
  }

  return roundCurrency(discountValue);
};

const distributeGlobalDiscount = (items, globalDiscountAmount) => {
  if (globalDiscountAmount <= 0) {
    return items.map((item) => ({
      ...item,
      additional_discount_amount: 0,
      total_discount_amount: item.discount_amount,
      line_net: roundCurrency(item.line_subtotal - item.discount_amount),
    }));
  }

  const discountBase = roundCurrency(
    items.reduce((sum, item) => sum + (item.line_subtotal - item.discount_amount), 0)
  );

  if (discountBase <= 0) {
    throw createHttpError(400, "Cannot apply a sale discount when item subtotals are zero");
  }

  let assignedDiscount = 0;

  return items.map((item, index) => {
    const remainingBase = roundCurrency(item.line_subtotal - item.discount_amount);

    let additionalDiscountAmount = 0;
    if (index === items.length - 1) {
      additionalDiscountAmount = roundCurrency(globalDiscountAmount - assignedDiscount);
    } else {
      additionalDiscountAmount = roundCurrency((globalDiscountAmount * remainingBase) / discountBase);
      assignedDiscount = roundCurrency(assignedDiscount + additionalDiscountAmount);
    }

    if (additionalDiscountAmount > remainingBase) {
      throw createHttpError(
        400,
        `Global discount cannot exceed the net subtotal for branch_product_id ${item.branch_product_id}`
      );
    }

    const totalDiscountAmount = roundCurrency(item.discount_amount + additionalDiscountAmount);
    return {
      ...item,
      additional_discount_amount: additionalDiscountAmount,
      total_discount_amount: totalDiscountAmount,
      line_net: roundCurrency(item.line_subtotal - totalDiscountAmount),
    };
  });
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

    const quantity = parsePositiveNumber(item.quantity, `items[${index}].quantity`);
    const unitPrice = parsePositiveNumber(item.unit_price, `items[${index}].unit_price`, true);
    const discountAmount = parsePositiveNumber(
      item.discount_amount ?? 0,
      `items[${index}].discount_amount`,
      true
    );
    const lineSubtotal = roundCurrency(quantity * unitPrice);

    if (discountAmount > lineSubtotal) {
      throw createHttpError(
        400,
        `items[${index}].discount_amount cannot be greater than line subtotal`
      );
    }

    return {
      branch_product_id: parseRequiredInt(item.branch_product_id, `items[${index}].branch_product_id`),
      quantity,
      unit_price: roundCurrency(unitPrice),
      discount_amount: roundCurrency(discountAmount),
      line_subtotal: lineSubtotal,
    };
  });

  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.line_subtotal, 0));
  const itemDiscountTotal = roundCurrency(items.reduce((sum, item) => sum + item.discount_amount, 0));
  const discountValue = roundCurrency(parsePositiveNumber(payload.discount_value ?? 0, "discount_value", true));
  const discountType = normalizeDiscountType(payload.discount_type, discountValue);
  const discountBase = roundCurrency(subtotal - itemDiscountTotal);
  const globalDiscountAmount = calculateGlobalDiscountAmount(discountType, discountValue, discountBase);
  const normalizedItems = distributeGlobalDiscount(items, globalDiscountAmount);

  return {
    branch_id: parseRequiredInt(payload.branch_id, "branch_id"),
    client_id: parseOptionalInt(payload.client_id, "client_id"),
    customer_name: normalizeString(payload.customer_name),
    customer_document: normalizeString(payload.customer_document),
    payment_method: normalizePaymentMethod(payload.payment_method),
    payment_status: normalizePaymentStatus(payload.payment_status),
    discount_type: discountType,
    discount_value: discountValue,
    notes: normalizeString(payload.notes),
    items: normalizedItems,
    subtotal,
    total_discount: roundCurrency(itemDiscountTotal + globalDiscountAmount),
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

  if (
    !actor.pharmacy_id ||
    Number.parseInt(actor.pharmacy_id, 10) !== Number.parseInt(branch.pharmacy_id, 10)
  ) {
    throw createHttpError(403, "User cannot operate this branch");
  }

  if (actor.role_code === "CASHIER" || actor.role_code === "BRANCH_ADMIN") {
    const hasAccess = await hasActiveBranchAccess(connection, actor.id, branch.id);
    if (!hasAccess) {
      throw createHttpError(403, "User has no access to this branch");
    }
  }
};

const mapSaleSummary = (sale) => ({
  id: Number.parseInt(sale.id, 10),
  client_id: sale.client_id ? Number.parseInt(sale.client_id, 10) : null,
  ticket_number: sale.sale_number,
  subtotal: toNumber(sale.subtotal),
  discount_amount: toNumber(sale.discount_amount),
  tax_amount: toNumber(sale.tax_amount),
  total: toNumber(sale.total ?? sale.total_amount),
  payment_method: sale.payment_method ?? null,
  payment_status: sale.payment_status ?? null,
  discount_type: sale.discount_type ?? null,
  discount_value: toNumber(sale.discount_value),
  created_at: sale.created_at,
});

const mapSaleItem = (item) => ({
  id: Number.parseInt(item.id, 10),
  branch_product_id: Number.parseInt(item.branch_product_id, 10),
  product_id: item.product_id ? Number.parseInt(item.product_id, 10) : null,
  product_name: item.product_name,
  sku: item.sku,
  quantity: toNumber(item.quantity),
  unit_price: toNumber(item.unit_price),
  discount_amount: toNumber(item.discount_amount),
  tax_rate: toNumber(item.tax_rate),
  tax_amount: toNumber(item.tax_amount),
  line_total: toNumber(item.line_total ?? item.total_price),
  requires_prescription: normalizeBoolean(item.requires_prescription),
});

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

    let selectedClient = null;
    if (normalized.client_id) {
      selectedClient = await findClientById(connection, normalized.client_id);

      if (!selectedClient) {
        throw createHttpError(400, "client_id does not exist");
      }

      if (Number.parseInt(selectedClient.pharmacy_id, 10) !== Number.parseInt(branch.pharmacy_id, 10)) {
        throw createHttpError(400, "client_id does not belong to the branch pharmacy");
      }

      if (String(selectedClient.status).toLowerCase() !== "active") {
        throw createHttpError(400, "client_id is inactive");
      }
    }

    const sequence = await getNextSaleSequenceForBranchToday(connection, normalized.branch_id);
    const saleNumber = buildSaleNumber(normalized.branch_id, sequence);

    let taxTotal = 0;
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

      if (!normalizeBoolean(branchProduct.is_sellable ?? 1)) {
        throw createHttpError(400, `branch_product_id ${item.branch_product_id} is not sellable`);
      }

      const lots = await findAvailableLotsFefo(connection, item.branch_product_id);
      const availableStock = roundCurrency(
        lots.reduce((sum, lot) => sum + Number.parseFloat(lot.current_quantity || 0), 0)
      );

      if (availableStock < item.quantity) {
        throw createHttpError(
          400,
          `Insufficient stock for branch_product_id ${item.branch_product_id}. Available: ${availableStock}, Requested: ${item.quantity}`
        );
      }

      const taxRate = toNumber(branchProduct.tax_rate);
      const lineTax = roundCurrency((item.line_net * taxRate) / 100);
      item.tax_rate = taxRate;
      item.tax_amount = lineTax;
      item.line_total = roundCurrency(item.line_net + lineTax);
      item.branch_product = branchProduct;
      item.lots = lots;
      taxTotal = roundCurrency(taxTotal + lineTax);
    }

    const grandTotal = roundCurrency(normalized.subtotal - normalized.total_discount + taxTotal);

    const saleId = await insertSale(connection, {
      pharmacy_id: branch.pharmacy_id,
      branch_id: normalized.branch_id,
      cashier_user_id: actor.id,
      client_id: normalized.client_id,
      user_id: actor.id,
      sale_number: saleNumber,
      sequence_number: sequence,
      customer_name: selectedClient?.full_name ?? normalized.customer_name,
      customer_document: selectedClient?.document_number ?? normalized.customer_document,
      subtotal: normalized.subtotal,
      discount_amount: normalized.total_discount,
      discount_type: normalized.discount_type,
      discount_value: normalized.discount_value,
      tax_amount: taxTotal,
      total: grandTotal,
      total_amount: grandTotal,
      payment_method: normalized.payment_method,
      payment_status: normalized.payment_status,
      sale_status: "completed",
      status: "completed",
      notes: normalized.notes,
    });

    for (const item of normalized.items) {
      const branchProduct = item.branch_product;
      const saleDetailId = await insertSaleDetail(connection, {
        sale_id: saleId,
        branch_product_id: item.branch_product_id,
        product_id: branchProduct.product_id,
        product_name: branchProduct.product_name,
        sku: branchProduct.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.total_discount_amount,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        total_price: item.line_total,
        requires_prescription: normalizeBoolean(branchProduct.requires_prescription) ? 1 : 0,
      });

      let remainingQuantity = item.quantity;
      let runningPreviousStock = Number.parseFloat(branchProduct.current_stock || 0);

      for (const lot of item.lots) {
        if (remainingQuantity <= 0) break;

        const lotCurrentQuantity = Number.parseFloat(lot.current_quantity || 0);
        if (lotCurrentQuantity <= 0) continue;

        const consumedQuantity = Math.min(remainingQuantity, lotCurrentQuantity);
        const lotNewQuantity = roundCurrency(lotCurrentQuantity - consumedQuantity);

        await updateInventoryLotStock(connection, lot.id, lotNewQuantity, actor.id);

        await insertSaleDetailLot(connection, {
          sale_detail_id: saleDetailId,
          inventory_lot_id: lot.id,
          quantity: consumedQuantity,
          unit_cost: lot.purchase_price,
          expiration_date: lot.expiration_date,
        });

        const runningNewStock = roundCurrency(runningPreviousStock - consumedQuantity);
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
          notes: `Venta ${saleNumber}`,
          moved_by: actor.id,
          created_by: actor.id,
        });

        runningPreviousStock = runningNewStock;
        remainingQuantity = roundCurrency(remainingQuantity - consumedQuantity);
      }

      await updateBranchProductStock(connection, item.branch_product_id, runningPreviousStock, actor.id);
    }

    await connection.commit();

    return {
      id: saleId,
      client_id: normalized.client_id,
      ticket_number: saleNumber,
      subtotal: normalized.subtotal,
      discount_amount: normalized.total_discount,
      tax_amount: taxTotal,
      total: grandTotal,
      payment_method: normalized.payment_method,
      payment_status: normalized.payment_status,
      discount_type: normalized.discount_type,
      discount_value: normalized.discount_value,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getSaleById = async (saleId, actorUserId) => {
  const normalizedSaleId = parseRequiredInt(saleId, "id");
  const connection = await pool.getConnection();

  try {
    const actor = await getActorContext(connection, actorUserId);
    const sale = await findSaleById(connection, normalizedSaleId);

    if (!sale) {
      throw createHttpError(404, "Sale not found");
    }

    const branch = await findBranchById(connection, sale.branch_id);
    if (!branch) {
      throw createHttpError(404, "Sale branch not found");
    }

    await assertUserCanOperateBranch(connection, actor, branch);

    const items = await findSaleItemsBySaleId(connection, normalizedSaleId);
    const selectedClient = sale.client_id ? await findClientById(connection, sale.client_id) : null;

    return {
      ...mapSaleSummary(sale),
      branch_id: Number.parseInt(sale.branch_id, 10),
      client_id: sale.client_id ? Number.parseInt(sale.client_id, 10) : null,
      pharmacy_id: sale.pharmacy_id ? Number.parseInt(sale.pharmacy_id, 10) : null,
      cashier_user_id: sale.cashier_user_id ? Number.parseInt(sale.cashier_user_id, 10) : null,
      customer_name: sale.customer_name,
      customer_document: sale.customer_document,
      client: selectedClient
        ? {
            id: Number.parseInt(selectedClient.id, 10),
            full_name: selectedClient.full_name,
            document_number: selectedClient.document_number,
          }
        : null,
      notes: sale.notes,
      items: items.map(mapSaleItem),
    };
  } finally {
    connection.release();
  }
};
