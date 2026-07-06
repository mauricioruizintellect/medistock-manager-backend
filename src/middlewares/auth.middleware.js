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
      throw createHttpError(401, "El encabezado de autorización es obligatorio");
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw createHttpError(401, "Formato de autorización inválido");
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw createHttpError(500, "JWT_SECRET no está configurado");
    }

    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;

    next();
  } catch (error) {
    if (!error.status) {
      error.status = 401;
      error.message = "Token inválido o expirado";
    }

    next(error);
  }
};

const normalizeBoolean = (value) => value === true || value === 1 || value === "1";
const normalizeRoleCode = (value) => (value ? String(value).toUpperCase() : null);

export const requireSuperAdmin = (req, _res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "Autenticación requerida");
    }

    if (!normalizeBoolean(req.user.is_super_admin)) {
      throw createHttpError(403, "Solo el superadministrador puede realizar esta acción");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdminOrSuperAdmin = (req, _res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "Autenticación requerida");
    }

    const isSuperAdmin = normalizeBoolean(req.user.is_super_admin);
    const roleCode = normalizeRoleCode(req.user.role_code);

    if (!isSuperAdmin && roleCode !== "ADMIN") {
      throw createHttpError(403, "Solo ADMIN o el superadministrador pueden realizar esta acción");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requirePharmacyAdminOrSuperAdmin = (req, _res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "Autenticación requerida");
    }

    const isSuperAdmin = normalizeBoolean(req.user.is_super_admin);
    const roleCode = normalizeRoleCode(req.user.role_code);

    if (!isSuperAdmin && roleCode !== "PHARMACY_ADMIN") {
      throw createHttpError(
        403,
        "Solo PHARMACY_ADMIN o el superadministrador pueden realizar esta acción"
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
