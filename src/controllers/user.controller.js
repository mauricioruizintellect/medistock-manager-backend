import { createUser, updateUser } from "../services/user.service.js";

export const createUserHandler = async (req, res, next) => {
  try {
    const user = await createUser(req.body, req.user.userId);

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserHandler = async (req, res, next) => {
  try {
    const user = await updateUser(req.params.id, req.body, req.user.userId);

    res.status(200).json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};
