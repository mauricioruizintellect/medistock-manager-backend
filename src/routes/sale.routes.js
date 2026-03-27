import { Router } from "express";
import { createSaleHandler } from "../controllers/sale.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createSaleHandler);

export default router;
