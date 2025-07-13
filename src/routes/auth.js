import express from "express";
import { prisma } from "../startup/connectToDatabase.js";

const router = express.Router();

// Ordinarily, we'd use the username/email & password, store the hashed password in the DB and set JWT in the header
// with an expiry date, but for the sake of simplicity and brevity, we'll return a dummy value for now

router.post("/", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  // Return a dummy token
  const dummyToken = `dummy-token-${user.id}`;

  res.set(`Authorization`, `Bearer ${dummyToken}`);
  res.json({ token: dummyToken });
});

export default router;
