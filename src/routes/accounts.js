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

router.get("/:accountNumber", [requireAuth], async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const authenticatedUserId = req.authenticatedUserId;
    const accountNumberPattern = /^01\d{6}$/;

    if (!accountNumberPattern.test(accountNumber)) {
      return res.status(400).json({ message: "Invalid account number format" });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(401).json({ message: "Access token is missing or invalid" });
    }

    const account = await prisma.account.findUnique({ where: { accountNumber } });

    if (!account) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // Check if the authenticated user owns this account
    if (account.userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Access forbidden" });
    }

    return res.status(200).json({
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
    console.error("Error fetching account:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.patch("/:accountNumber", [requireAuth], async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const { name, accountType } = req.body;
    const authenticatedUserId = req.authenticatedUserId;

    // Validate account number format (must match pattern ^01\d{6}$)
    const accountNumberPattern = /^01\d{6}$/;
    if (!accountNumberPattern.test(accountNumber)) {
      return res.status(400).json({ message: "Invalid account number format" });
    }

    // Validate that at least one field is provided for update
    if (!name && !accountType) {
      return res
        .status(400)
        .json({ message: "At least one field (name or accountType) must be provided" });
    }

    // Validate accountType if provided
    if (accountType && accountType !== "personal") {
      return res.status(400).json({ message: "Invalid accountType. Must be 'personal'" });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(401).json({ message: "Access token is missing or invalid" });
    }

    const account = await prisma.account.findUnique({ where: { accountNumber } });
    if (!account) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // Check if the authenticated user owns this account
    if (account.userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Access forbidden" });
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (accountType) updateData.accountType = accountType;
    updateData.updatedTimestamp = new Date().toISOString();

    const updatedAccount = await prisma.account.update({
      where: { accountNumber },
      data: updateData
    });

    return res.status(200).json({
      accountNumber: updatedAccount.accountNumber,
      sortCode: updatedAccount.sortCode,
      name: updatedAccount.name,
      accountType: updatedAccount.accountType,
      balance: updatedAccount.balance / 100,
      currency: updatedAccount.currency,
      createdTimestamp: updatedAccount.createdTimestamp,
      updatedTimestamp: updatedAccount.updatedTimestamp
    });
  } catch (err) {
    console.error("Error updating account:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.delete("/:accountNumber", [requireAuth], async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const authenticatedUserId = req.authenticatedUserId;

    // Validate account number format (must match pattern ^01\d{6}$)
    const accountNumberPattern = /^01\d{6}$/;
    if (!accountNumberPattern.test(accountNumber)) {
      return res.status(400).json({ message: "Invalid account number format" });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(401).json({ message: "Access token is missing or invalid" });
    }

    const account = await prisma.account.findUnique({ where: { accountNumber } });
    if (!account) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // Check if the authenticated user owns this account
    if (account.userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Access forbidden" });
    }

    await prisma.account.delete({ where: { accountNumber } });

    return res.status(204).send();
  } catch (err) {
    console.error("Error deleting account:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

export default router;
