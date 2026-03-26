import { Router } from "express";
import {
  createPharmacyHandler,
  updatePharmacyHandler,
} from "../controllers/pharmacy.controller.js";
import { authMiddleware, requireSuperAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, requireSuperAdmin, createPharmacyHandler);
router.put("/:id", authMiddleware, requireSuperAdmin, updatePharmacyHandler);

export default router;
