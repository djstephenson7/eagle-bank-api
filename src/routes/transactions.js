import express from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  accountNumberParamSchema,
  validateParams,
  validateSchema
} from "../middleware/validateAccountSchemas.js";
import { createTransactionSchema } from "../middleware/validateTransactionSchema.js";
import { prisma } from "../startup/connectToDatabase.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";

const router = express.Router();

router.post(
  "/:accountNumber/transactions",
  [requireAuth, validateParams(accountNumberParamSchema), validateSchema(createTransactionSchema)],
  async (req, res, next) => {
    try {
      const { accountNumber } = req.params;
      const { amount, currency, type, reference } = req.body;
      const authenticatedUserId = req.authenticatedUserId;

      if (amount < 1) {
        return res.status(400).json({ message: "Amount must be at least 1 penny" });
      }

      // Amount is already in pence, no conversion needed
      const amountInPence = amount;

      const account = await prisma.account.findUnique({ where: { accountNumber } });
      if (!account) {
        return res.status(404).json({ message: "Bank account was not found" });
      }
      if (account.userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Access forbidden" });
      }

      if (type === "withdrawal" && account.balance < amountInPence) {
        return res.status(422).json({ message: "Insufficient funds to process transaction" });
      }

      let newBalance = account.balance;
      if (type === "deposit") {
        newBalance += amountInPence;
      } else if (type === "withdrawal") {
        newBalance -= amountInPence;
      }

      // Transaction ID
      const transactionId = `tan-${crypto.randomBytes(8).toString("hex")}`;

      // Create transaction and update balance atomically
      const [, transaction] = await prisma.$transaction([
        prisma.account.update({
          where: { accountNumber },
          data: { balance: newBalance, updatedTimestamp: new Date().toISOString() }
        }),
        prisma.transaction.create({
          data: {
            id: transactionId,
            amount: amountInPence,
            currency,
            type,
            reference: reference || "",
            userId: authenticatedUserId,
            accountId: account.id,
            createdTimestamp: new Date().toISOString()
          }
        })
      ]);

      return res.status(201).json({
        id: transaction.id,
        amount: amountInPence,
        currency: transaction.currency,
        type: transaction.type,
        reference: transaction.reference,
        userId: transaction.userId,
        createdTimestamp: transaction.createdTimestamp
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ForbiddenError) return next(err);
      if (err.message && err.message.includes("Insufficient funds")) {
        return res.status(422).json({ message: err.message });
      }
      console.error("Transaction error:", err);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  }
);

export default router;
