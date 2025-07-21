import pino from "pino";

const logger = pino();

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const message = err.status ? err.message : "An unexpected error occurred";
  const stack = process.env.NODE_ENV !== "production" && err.stack;
  const status = err.status || 500;

  console.error(stack);

  logger.error({ message, status, stack });

  res.status(status).json({ message });
}
