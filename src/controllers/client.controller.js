import {
  createClient,
  getClientById,
  getClients,
  updateClient,
} from "../services/client.service.js";

export const getClientsHandler = async (req, res, next) => {
  try {
    const result = await getClients(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getClientByIdHandler = async (req, res, next) => {
  try {
    const client = await getClientById(req.params.id, req.user.userId);

    res.status(200).json({
      client,
    });
  } catch (error) {
    next(error);
  }
};

export const createClientHandler = async (req, res, next) => {
  try {
    const client = await createClient(req.body, req.user.userId);

    res.status(201).json({
      message: "Cliente creado correctamente",
      client,
    });
  } catch (error) {
    next(error);
  }
};

export const updateClientHandler = async (req, res, next) => {
  try {
    const client = await updateClient(req.params.id, req.body, req.user.userId);

    res.status(200).json({
      message: "Cliente actualizado correctamente",
      client,
    });
  } catch (error) {
    next(error);
  }
};
