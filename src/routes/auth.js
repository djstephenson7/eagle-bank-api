import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../consts/index.js";
import { prisma } from "../startup/connectToDatabase.js";
import { UnauthorisedError, ValidationError } from "../utils/errors.js";

const router = express.Router();

router.post("/", async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) throw new ValidationError("Email is required");

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorisedError("User not found");

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });

    res.set("Authorization", `Bearer ${token}`);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

export default router;
