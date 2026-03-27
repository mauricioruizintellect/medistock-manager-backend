import { Router } from "express";
import {
  createProductHandler,
  getProductsByPharmacyHandler,
} from "../controllers/product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createProductHandler);
router.get("/", authMiddleware, getProductsByPharmacyHandler);

export default router;
