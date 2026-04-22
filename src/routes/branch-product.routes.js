import { Router } from "express";
import {
  createBranchProductHandler,
  getBranchProductsHandler,
} from "../controllers/branch-product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBranchProductHandler);
router.get("/", authMiddleware, getBranchProductsHandler);

export default router;
