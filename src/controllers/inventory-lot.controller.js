import { initialLoadInventoryLots } from "../services/inventory-lot.service.js";

export const initialLoadInventoryLotsHandler = async (req, res, next) => {
  try {
    const result = await initialLoadInventoryLots(req.body, req.user.userId);

    res.status(201).json({
      message: "Initial inventory load completed successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
