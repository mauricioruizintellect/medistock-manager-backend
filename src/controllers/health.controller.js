import { buildHealthStatus } from "../services/health.service.js";

export const getHealth = (_req, res) => {
  res.status(200).json(buildHealthStatus());
};
