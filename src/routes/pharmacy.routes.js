import { Router } from "express";
import {
  createPharmacyHandler,
  getPharmacyByIdHandler,
  updatePharmacyHandler,
} from "../controllers/pharmacy.controller.js";
import {
  authMiddleware,
  requireAdminOrSuperAdmin,
  requirePharmacyAdminOrSuperAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, requireAdminOrSuperAdmin, createPharmacyHandler);
router.get("/:id", authMiddleware, getPharmacyByIdHandler);
router.put(
  "/:id",
  authMiddleware,
  requirePharmacyAdminOrSuperAdmin,
  updatePharmacyHandler
);

export default router;
