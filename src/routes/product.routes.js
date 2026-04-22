import { Router } from "express";
import {
  createProductHandler,
  getProductByIdHandler,
  getProductsByPharmacyHandler,
  updateProductHandler,
} from "../controllers/product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createProductHandler);
router.get("/", authMiddleware, getProductsByPharmacyHandler);
router.get("/:id", authMiddleware, getProductByIdHandler);
router.put("/:id", authMiddleware, updateProductHandler);

export default router;
