import {
  createPharmacy,
  getPharmacyById,
  updatePharmacy,
} from "../services/pharmacy.service.js";

export const createPharmacyHandler = async (req, res, next) => {
  try {
    const pharmacy = await createPharmacy({
      ...req.body,
      actorUserId: req.user.userId,
    });

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
    const pharmacy = await updatePharmacy(req.params.id, {
      ...req.body,
      actorUserId: req.user.userId,
    });

    res.status(200).json({
      message: "Pharmacy updated successfully",
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};

export const getPharmacyByIdHandler = async (req, res, next) => {
  try {
    const pharmacy = await getPharmacyById(req.params.id);

    if (!pharmacy) {
      const error = new Error("Pharmacy not found");
      error.status = 404;
      throw error;
    }

    res.status(200).json({
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};
