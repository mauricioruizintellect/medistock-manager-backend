export const findUserContextById = async (connection, userId) => {
  const [rows] = await connection.execute(
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

  return rows[0] || null;
};

export const findBranchById = async (connection, branchId) => {
  const [rows] = await connection.execute(
    `
      SELECT id, pharmacy_id, status
      FROM branches
      WHERE id = ?
      LIMIT 1
    `,
    [branchId]
  );

  return rows[0] || null;
};

export const hasActiveBranchAccess = async (connection, userId, branchId) => {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM user_branch_roles
      WHERE user_id = ? AND branch_id = ? AND status = 'active'
      LIMIT 1
    `,
    [userId, branchId]
  );

  return rows.length > 0;
};

export const insertSale = async (connection, payload) => {
  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await connection.execute(
    `INSERT INTO sales (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
};

export const insertSaleDetail = async (connection, payload) => {
  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await connection.execute(
    `INSERT INTO sale_details (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
};

export const insertSaleDetailLot = async (connection, payload) => {
  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  await connection.execute(
    `INSERT INTO sale_detail_lots (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );
};

export const getNextSaleSequenceForBranchToday = async (connection, branchId) => {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM sales
      WHERE branch_id = ? AND DATE(created_at) = CURDATE()
      FOR UPDATE
    `,
    [branchId]
  );

  return Number.parseInt(rows[0]?.total || 0, 10) + 1;
};

export const findBranchProductForUpdate = async (connection, branchProductId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        bp.id,
        bp.branch_id,
        bp.status,
        bp.current_stock,
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.tax_rate,
        p.requires_prescription
      FROM branch_products bp
      JOIN products p ON p.id = bp.product_id
      WHERE bp.id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [branchProductId]
  );

  return rows[0] || null;
};

export const findAvailableLotsFefo = async (connection, branchProductId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        purchase_price,
        current_quantity,
        expiration_date,
        received_at,
        status
      FROM inventory_lots
      WHERE branch_product_id = ?
        AND current_quantity > 0
        AND expiration_date > CURDATE()
        AND status = 'active'
      ORDER BY expiration_date ASC, received_at ASC, id ASC
      FOR UPDATE
    `,
    [branchProductId]
  );

  return rows;
};

export const updateInventoryLotStock = async (
  connection,
  inventoryLotId,
  newQuantity,
  updatedBy
) => {
  const nextStatus = Number.parseFloat(newQuantity) === 0 ? "depleted" : "active";

  await connection.execute(
    `
      UPDATE inventory_lots
      SET current_quantity = ?, status = ?, updated_by = ?
      WHERE id = ?
    `,
    [newQuantity, nextStatus, updatedBy, inventoryLotId]
  );
};

export const updateBranchProductStock = async (
  connection,
  branchProductId,
  newStock,
  updatedBy
) => {
  await connection.execute(
    `
      UPDATE branch_products
      SET current_stock = ?, updated_by = ?
      WHERE id = ?
    `,
    [newStock, updatedBy, branchProductId]
  );
};

export const insertInventoryMovement = async (connection, payload) => {
  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  await connection.execute(
    `INSERT INTO inventory_movements (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );
};
