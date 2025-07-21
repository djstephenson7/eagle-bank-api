import express from "express";

import { prisma } from "../startup/connectToDatabase.js";
import { ForbiddenError, NotFoundError, UnauthorisedError } from "../utils/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  accountNumberParamSchema,
  createAccountSchema,
  updateAccountSchema,
  validateParams,
  validateSchema
} from "../middleware/validateAccountSchemas.js";

const router = express.Router();

router.post("/", [requireAuth, validateSchema(createAccountSchema)], async (req, res, next) => {
  try {
    const { name, accountType } = req.body;
    const authenticatedUserId = req.authenticatedUserId;

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });

    if (!user) throw new UnauthorisedError();

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
    next(err);
  }
});

router.get("/", [requireAuth], async (req, res, next) => {
  try {
    const authenticatedUserId = req.authenticatedUserId;
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });

    if (!user) throw new UnauthorisedError();

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
    next(err);
  }
});

router.get(
  "/:accountNumber",
  [requireAuth, validateParams(accountNumberParamSchema)],
  async (req, res, next) => {
    try {
      const { accountNumber } = req.params;
      const authenticatedUserId = req.authenticatedUserId;

      const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });

      if (!user) throw new UnauthorisedError();

      const account = await prisma.account.findUnique({ where: { accountNumber } });

      if (!account) throw new NotFoundError("Bank account not found");

      // Check if the authenticated user owns this account
      if (account.userId !== authenticatedUserId) throw new ForbiddenError("Access forbidden");

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
      next(err);
    }
  }
);

router.patch(
  "/:accountNumber",
  [requireAuth, validateParams(accountNumberParamSchema), validateSchema(updateAccountSchema)],
  async (req, res, next) => {
    try {
      const { accountNumber } = req.params;
      const { name, accountType } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.authenticatedUserId } });
      if (!user) throw new UnauthorisedError();

      const account = await prisma.account.findUnique({ where: { accountNumber } });
      if (!account) throw new NotFoundError("Bank account not found");

      if (account.userId !== req.authenticatedUserId) throw new ForbiddenError();

      const updateData = { updatedTimestamp: new Date().toISOString() };
      if (name) updateData.name = name;
      if (accountType) updateData.accountType = accountType;

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
      next(err);
    }
  }
);

router.delete(
  "/:accountNumber",
  [requireAuth, validateParams(accountNumberParamSchema)],
  async (req, res) => {
    try {
      const { accountNumber } = req.params;
      const authenticatedUserId = req.authenticatedUserId;

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
  }
);

export default router;
