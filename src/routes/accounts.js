import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { prisma } from "../startup/connectToDatabase.js";

const router = express.Router();

router.post("/", [requireAuth], async (req, res) => {
  try {
    const { name, accountType } = req.body;
    const authenticatedUserId = req.authenticatedUserId;

    if (!name || !accountType) {
      return res.status(400).json({ message: "Missing required fields: name and accountType" });
    }

    if (accountType !== "personal") {
      return res.status(400).json({ message: "Invalid accountType. Must be 'personal'" });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(401).json({ message: "Access token is missing or invalid" });
    }

    const account = await prisma.account.create({
      data: {
        accountNumber: `01${Math.floor(Math.random() * 900000 + 100000)}`,
        sortCode: "10-10-10",
        name,
        accountType,
        balance: 0,
        currency: "GBP",
        userId: authenticatedUserId,
        createdTimestamp: new Date().toISOString(),
        updatedTimestamp: new Date().toISOString()
      }
    });

    return res.status(201).json({
      accountNumber: account.accountNumber,
      sortCode: account.sortCode,
      name: account.name,
      accountType: account.accountType,
      balance: account.balance / 100,
      currency: account.currency,
      createdTimestamp: account.createdTimestamp,
      updatedTimestamp: account.updatedTimestamp
    });
  } catch (err) {
    console.error("Error creating account:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.get("/", [requireAuth], async (req, res) => {
  try {
    const authenticatedUserId = req.authenticatedUserId;

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(401).json({ message: "Access token is missing or invalid" });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: authenticatedUserId },
      orderBy: { createdTimestamp: "desc" }
    });

    return res.status(200).json({
      accounts: accounts.map((account) => ({
        accountNumber: account.accountNumber,
        sortCode: account.sortCode,
        name: account.name,
        accountType: account.accountType,
        balance: account.balance / 100,
        currency: account.currency,
        createdTimestamp: account.createdTimestamp,
        updatedTimestamp: account.updatedTimestamp
      }))
    });
  } catch (err) {
    console.error("Error fetching accounts:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

export default router;
