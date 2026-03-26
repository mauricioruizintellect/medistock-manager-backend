import jwt from "jsonwebtoken";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const authMiddleware = (req, _res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      throw createHttpError(401, "Authorization header is required");
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw createHttpError(401, "Invalid authorization format");
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw createHttpError(500, "JWT_SECRET is not configured");
    }

    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;

    next();
  } catch (error) {
    if (!error.status) {
      error.status = 401;
      error.message = "Invalid or expired token";
    }

    next(error);
  }
};
