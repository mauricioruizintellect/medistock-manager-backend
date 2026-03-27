import { Router } from "express";
import {
  createPharmacyHandler,
  updatePharmacyHandler,
} from "../controllers/pharmacy.controller.js";
import {
  authMiddleware,
  requireAdminOrSuperAdmin,
  requirePharmacyAdminOrSuperAdmin,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, requireAdminOrSuperAdmin, createPharmacyHandler);
router.put(
  "/:id",
  authMiddleware,
  requirePharmacyAdminOrSuperAdmin,
  updatePharmacyHandler
);

export default router;
