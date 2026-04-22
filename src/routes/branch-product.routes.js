import { Router } from "express";
import {
  createBranchProductHandler,
  getBranchProductsHandler,
  updateBranchProductHandler,
} from "../controllers/branch-product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBranchProductHandler);
router.get("/", authMiddleware, getBranchProductsHandler);
router.put("/:id", authMiddleware, updateBranchProductHandler);

export default router;
