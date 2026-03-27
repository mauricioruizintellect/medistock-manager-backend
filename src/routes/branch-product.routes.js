import { Router } from "express";
import { createBranchProductHandler } from "../controllers/branch-product.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBranchProductHandler);

export default router;
