export const buildHealthStatus = () => ({
  status: "ok",
  environment: process.env.NODE_ENV || "development",
  timestamp: new Date().toISOString(),
});
