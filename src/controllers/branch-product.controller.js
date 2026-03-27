import { createBranchProduct } from "../services/branch-product.service.js";

export const createBranchProductHandler = async (req, res, next) => {
  try {
    const branchProduct = await createBranchProduct(req.body, req.user.userId);

    res.status(201).json({
      message: "Branch product created successfully",
      branch_product: branchProduct,
    });
  } catch (error) {
    next(error);
  }
};
