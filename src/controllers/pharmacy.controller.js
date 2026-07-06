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
      message: "Farmacia creada correctamente",
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
      message: "Farmacia actualizada correctamente",
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};

export const getPharmacyByIdHandler = async (req, res, next) => {
  try {
    const pharmacy = await getPharmacyById(req.params.id, req.user.userId);

    if (!pharmacy) {
      const error = new Error("Farmacia no encontrada");
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
