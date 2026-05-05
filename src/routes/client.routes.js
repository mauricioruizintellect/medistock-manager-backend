import { Router } from "express";
import {
  createClientHandler,
  getClientByIdHandler,
  getClientsHandler,
  updateClientHandler,
} from "../controllers/client.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authMiddleware, getClientsHandler);
router.get("/:id", authMiddleware, getClientByIdHandler);
router.post("/", authMiddleware, createClientHandler);
router.put("/:id", authMiddleware, updateClientHandler);

export default router;
