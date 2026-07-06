import {
  initialLoadInventoryLots,
  receiveInventoryLots,
} from "../services/inventory-lot.service.js";

export const initialLoadInventoryLotsHandler = async (req, res, next) => {
  try {
    const result = await initialLoadInventoryLots(req.body, req.user.userId);

    res.status(201).json({
      message: "Carga inicial de inventario completada correctamente",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const receiveInventoryLotsHandler = async (req, res, next) => {
  try {
    const result = await receiveInventoryLots(req.body, req.user.userId);

    res.status(201).json({
      message: "Lotes de inventario recibidos correctamente",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
