import express from "express";
import { prisma } from "../startup/connectToDatabase.js";
import { UnauthorisedError } from "../utils/errors.js";

const router = express.Router();

// Ordinarily, we'd use the username/email & password, store the hashed password in the DB and set JWT in the header
// with an expiry date, but for the sake of simplicity and brevity, we'll return a dummy value for now

router.post("/", async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorisedError("User not found");

    // Return a dummy token
    const dummyToken = `dummy-token-${user.id}`;

    res.set(`Authorization`, `Bearer ${dummyToken}`);
    res.json({ token: dummyToken });
  } catch (err) {
    next(err);
  }
});

export default router;
