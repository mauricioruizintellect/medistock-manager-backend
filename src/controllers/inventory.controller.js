import { getInventoryMovements, getInventoryStock } from "../services/inventory.service.js";

export const getInventoryStockHandler = async (req, res, next) => {
  try {
    const result = await getInventoryStock(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getInventoryMovementsHandler = async (req, res, next) => {
  try {
    const result = await getInventoryMovements(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
