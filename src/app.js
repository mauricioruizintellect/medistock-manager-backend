import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes/index.js";
import authPublicRoutes from "./routes/auth.public.routes.js";

const app = express();

const isDevelopment = process.env.NODE_ENV !== "production";
const allowedOrigin = process.env.CLIENT_ORIGIN || "*";

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigin,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isDevelopment ? "dev" : "combined"));

app.use("/api/v1/auth", authPublicRoutes);
app.use("/api/v1", apiRoutes);

app.use((_req, _res, next) => {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  res.status(status).json({
    message,
    ...(isDevelopment ? { stack: error.stack } : {}),
  });
});

export default app;
