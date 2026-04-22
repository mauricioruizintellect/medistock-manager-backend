import {
  createBranchProduct,
  getBranchProducts,
  updateBranchProduct,
} from "../services/branch-product.service.js";

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

export const getBranchProductsHandler = async (req, res, next) => {
  try {
    const result = await getBranchProducts(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateBranchProductHandler = async (req, res, next) => {
  try {
    const branchProduct = await updateBranchProduct(req.params.id, req.body, req.user.userId);

    res.status(200).json({
      message: "Branch product updated successfully",
      branch_product: branchProduct,
    });
  } catch (error) {
    next(error);
  }
};
