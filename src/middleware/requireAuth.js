export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  // For POC: just check the token follows the dummy format
  if (!token.startsWith("dummy-token-")) {
    return res.status(403).json({ message: "Invalid token" });
  }

  // Extract the user ID from the token and make it available to route handlers
  const authenticatedUserId = token.replace("dummy-token-", "");
  req.authenticatedUserId = authenticatedUserId;

  next();
};
