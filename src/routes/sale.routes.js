import { Router } from "express";
import { createSaleHandler, getSaleByIdHandler } from "../controllers/sale.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createSaleHandler);
router.get("/:id", authMiddleware, getSaleByIdHandler);

export default router;
