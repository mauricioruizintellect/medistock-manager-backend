import { createCategory } from "../services/product-category.service.js";

export const createCategoryHandler = async (req, res, next) => {
  try {
    const category = await createCategory(req.body, req.user.userId);

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
};
