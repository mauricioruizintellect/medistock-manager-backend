import { Router } from "express";
import { getMedicines } from "../controllers/medicine.controller.js";

const router = Router();

router.get("/", getMedicines);

export default router;
