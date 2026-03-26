import { createPharmacy, updatePharmacy } from "../services/pharmacy.service.js";

export const createPharmacyHandler = async (req, res, next) => {
  try {
    const pharmacy = await createPharmacy(req.body);

    res.status(201).json({
      message: "Pharmacy created successfully",
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePharmacyHandler = async (req, res, next) => {
  try {
    const pharmacy = await updatePharmacy(req.params.id, req.body);

    res.status(200).json({
      message: "Pharmacy updated successfully",
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};
