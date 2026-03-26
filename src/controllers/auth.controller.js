import { getAuthenticatedUser, loginUser } from "../services/auth.service.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.user.userId);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
