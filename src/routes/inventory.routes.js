import { Router } from "express";
import {
  getInventoryMovementsHandler,
  getInventoryStockHandler,
} from "../controllers/inventory.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/stock", authMiddleware, getInventoryStockHandler);
router.get("/movements", authMiddleware, getInventoryMovementsHandler);

export default router;
