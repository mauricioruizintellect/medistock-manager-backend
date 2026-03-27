import { Router } from "express";
import healthRoutes from "./health.routes.js";
import medicineRoutes from "./medicine.routes.js";
import authRoutes from "./auth.routes.js";
import pharmacyRoutes from "./pharmacy.routes.js";
import userRoutes from "./user.routes.js";
import branchRoutes from "./branch.routes.js";
import userBranchRoleRoutes from "./user-branch-role.routes.js";
import productCategoryRoutes from "./product-category.routes.js";
import productRoutes from "./product.routes.js";
import branchProductRoutes from "./branch-product.routes.js";
import inventoryLotRoutes from "./inventory-lot.routes.js";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    message: "MediStock Manager Backend API",
    version: "v1",
  });
});

router.use("/health", healthRoutes);
router.use("/medicines", medicineRoutes);
router.use("/auth", authRoutes);
router.use("/pharmacies", pharmacyRoutes);
router.use("/users", userRoutes);
router.use("/branches", branchRoutes);
router.use("/user-branch-roles", userBranchRoleRoutes);
router.use("/product-categories", productCategoryRoutes);
router.use("/products", productRoutes);
router.use("/branch-products", branchProductRoutes);
router.use("/inventory-lots", inventoryLotRoutes);

export default router;
