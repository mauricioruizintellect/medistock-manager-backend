import { createSale, getSaleById } from "../services/sale.service.js";

export const createSaleHandler = async (req, res, next) => {
  try {
    const sale = await createSale(req.body, req.user.userId);

    res.status(201).json({
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    next(error);
  }
};

export const getSaleByIdHandler = async (req, res, next) => {
  try {
    const sale = await getSaleById(req.params.id, req.user.userId);

    res.status(200).json({
      sale,
    });
  } catch (error) {
    next(error);
  }
};
