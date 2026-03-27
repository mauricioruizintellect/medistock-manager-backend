import { Router } from "express";
import { createUserHandler, updateUserHandler } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createUserHandler);
router.put("/:id", authMiddleware, updateUserHandler);

export default router;
