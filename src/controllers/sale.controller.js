import { createSale } from "../services/sale.service.js";

export const createSaleHandler = async (req, res, next) => {
  try {
    const result = await createSale(req.body, req.user.userId);

    res.status(201).json({
      message: "Sale created successfully",
      sale: result,
    });
  } catch (error) {
    next(error);
  }
};
