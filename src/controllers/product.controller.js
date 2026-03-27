import { createProduct, getProductsByPharmacy } from "../services/product.service.js";

export const createProductHandler = async (req, res, next) => {
  try {
    const product = await createProduct(req.body, req.user.userId);

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductsByPharmacyHandler = async (req, res, next) => {
  try {
    const result = await getProductsByPharmacy(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
