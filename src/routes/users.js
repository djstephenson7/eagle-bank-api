import crypto from "crypto";
import express from "express";
import { requireAuth, validateUserAccess } from "../middleware";
import {
  createUserSchema,
  updateUserSchema,
  validateSchema
} from "../middleware/validateUserSchemas.js";
import { prisma } from "../startup/connectToDatabase.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

const router = express.Router();

router.post("/", [validateSchema(createUserSchema)], async (req, res, next) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      addressLine1,
      addressLine2,
      addressLine3,
      town,
      county,
      postcode
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) throw new ValidationError("A user with this email already exists.");

    const user = await prisma.user.create({
      data: {
        id: `usr-${crypto.randomUUID().replace(/-/g, "")}`,
        name,
        email,
        phoneNumber,
        addressLine1,
        addressLine2: addressLine2 || "",
        addressLine3: addressLine3 || "",
        town,
        county,
        postcode,
        createdTimestamp: new Date().toISOString(),
        updatedTimestamp: new Date().toISOString()
      }
    });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      createdTimestamp: user.createdTimestamp,
      updatedTimestamp: user.updatedTimestamp,
      address: {
        line1: user.addressLine1,
        line2: user.addressLine2,
        line3: user.addressLine3,
        town: user.town,
        county: user.county,
        postcode: user.postcode
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:userId", [requireAuth, validateUserAccess], async (req, res, next) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundError("User not found");

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      createdTimestamp: user.createdTimestamp,
      updatedTimestamp: user.updatedTimestamp,
      address: {
        line1: user.addressLine1,
        line2: user.addressLine2,
        line3: user.addressLine3,
        town: user.town,
        county: user.county,
        postcode: user.postcode
      }
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/:userId",
  [requireAuth, validateUserAccess, validateSchema(updateUserSchema)],
  async (req, res, next) => {
    const { userId } = req.params;
    const {
      name,
      email,
      phoneNumber,
      addressLine1,
      addressLine2,
      addressLine3,
      town,
      county,
      postcode
    } = req.body;

    // Check if at least one field is provided for update
    if (
      !name &&
      !email &&
      !phoneNumber &&
      !addressLine1 &&
      !addressLine2 &&
      !addressLine3 &&
      !town &&
      !county &&
      !postcode
    ) {
      throw new ValidationError("No update fields provided");
    }

    const updateData = { updatedTimestamp: new Date().toISOString() };

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (addressLine1) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
    if (addressLine3 !== undefined) updateData.addressLine3 = addressLine3;
    if (town) updateData.town = town;
    if (county) updateData.county = county;
    if (postcode) updateData.postcode = postcode;

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      if (!user) throw new NotFoundError("User was not found");

      return res.status(200).json({
        id: user.id,
        name: user.name,
        address: {
          line1: user.addressLine1,
          line2: user.addressLine2,
          line3: user.addressLine3,
          town: user.town,
          county: user.county,
          postcode: user.postcode
        },
        phoneNumber: user.phoneNumber,
        email: user.email,
        createdTimestamp: user.createdTimestamp,
        updatedTimestamp: user.updatedTimestamp
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:userId", [requireAuth, validateUserAccess], async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: true }
    });

    if (!user) {
      return res.status(404).json({ message: "User was not found" });
    }

    if (user.accounts && user.accounts.length > 0) {
      return res.status(409).json({
        message: "A user cannot be deleted when they are associated with a bank account"
      });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.status(204).send();
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

export default router;
