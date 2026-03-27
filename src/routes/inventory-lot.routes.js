import { Router } from "express";
import { initialLoadInventoryLotsHandler } from "../controllers/inventory-lot.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/initial-load", authMiddleware, initialLoadInventoryLotsHandler);

export default router;
