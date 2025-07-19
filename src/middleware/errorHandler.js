// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(err.stack);

  const message = err.status ? err.message : "An unexpected error occurred";
  const status = err.status || 500;

  res.status(status).json({ message });
}
