import { Router } from "express";
import {
  createBranchHandler,
  getBranchesHandler,
  updateBranchHandler,
} from "../controllers/branch.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBranchHandler);
router.get("/", authMiddleware, getBranchesHandler);
router.put("/:id", authMiddleware, updateBranchHandler);

export default router;
