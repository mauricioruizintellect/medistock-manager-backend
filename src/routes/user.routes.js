import { Router } from "express";
import {
  createUserHandler,
  getUsersByPharmacyIdHandler,
  getUserUtilitiesHandler,
  updateUserHandler,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/utilities/roles", authMiddleware, getUserUtilitiesHandler);
router.get("/pharmacy/:pharmacyId", authMiddleware, getUsersByPharmacyIdHandler);
router.post("/", authMiddleware, createUserHandler);
router.put("/:id", authMiddleware, updateUserHandler);

export default router;
