import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../consts/index.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.authenticatedUserId = decoded.userId;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};
