import { listMedicines } from "../services/medicine.service.js";

export const getMedicines = (_req, res) => {
  res.status(200).json({
    items: listMedicines(),
    total: listMedicines().length,
  });
};
