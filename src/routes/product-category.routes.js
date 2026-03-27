import { Router } from "express";
import { createCategoryHandler } from "../controllers/product-category.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createCategoryHandler);

export default router;
