import {
  createCategory,
  getCategoriesByPharmacy,
} from "../services/product-category.service.js";

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

export const getCategoriesByPharmacyHandler = async (req, res, next) => {
  try {
    const result = await getCategoriesByPharmacy(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
