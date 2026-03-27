export const findActorById = async (connection, userId) => {
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

export const findBranchProductById = async (connection, branchProductId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        bp.id,
        bp.branch_id,
        bp.current_stock,
        b.pharmacy_id
      FROM branch_products bp
      JOIN branches b ON b.id = bp.branch_id
      WHERE bp.id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [branchProductId]
  );

  return rows[0] || null;
};

export const findLotByBranchProductAndLotNumber = async (
  connection,
  branchProductId,
  lotNumber
) => {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM inventory_lots
      WHERE branch_product_id = ? AND lot_number = ?
      LIMIT 1
    `,
    [branchProductId, lotNumber]
  );

  return rows[0] || null;
};

export const insertInventoryLot = async (connection, payload) => {
  const fields = Object.keys(payload);
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => payload[field]);

  const [result] = await connection.execute(
    `INSERT INTO inventory_lots (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return result.insertId;
};

export const updateBranchProductCurrentStock = async (
  connection,
  branchProductId,
  newStock,
  actorUserId
) => {
  await connection.execute(
    `
      UPDATE branch_products
      SET current_stock = ?, updated_by = ?
      WHERE id = ?
    `,
    [newStock, actorUserId, branchProductId]
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
