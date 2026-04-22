import { Router } from "express";
import {
  initialLoadInventoryLotsHandler,
  receiveInventoryLotsHandler,
} from "../controllers/inventory-lot.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/initial-load", authMiddleware, initialLoadInventoryLotsHandler);
router.post("/receive", authMiddleware, receiveInventoryLotsHandler);

export default router;
