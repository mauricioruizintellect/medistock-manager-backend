import { Router } from "express";
import {
  createUserBranchRoleHandler,
  deleteUserBranchRoleHandler,
  getUserBranchRolesHandler,
} from "../controllers/user-branch-role.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createUserBranchRoleHandler);
router.get("/", authMiddleware, getUserBranchRolesHandler);
router.delete("/:id", authMiddleware, deleteUserBranchRoleHandler);

export default router;
