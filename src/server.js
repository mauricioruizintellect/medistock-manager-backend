import "dotenv/config";
import app from "./app.js";

const port = Number.parseInt(process.env.PORT, 10) || 3000;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error("Server startup error:", error);
  }
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down server...`);
  server.close(() => {
    console.log("Server closed successfully.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
