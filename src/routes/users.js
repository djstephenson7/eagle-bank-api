import express from "express";
import { prisma } from "../startup/connectToDatabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

const USER_ID_REGEX = /^usr-[A-Za-z0-9]+$/;

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      addressLine1,
      addressLine2 = "",
      addressLine3 = "",
      town,
      county,
      postcode
    } = req.body;

    if (!name || !email || !phoneNumber || !addressLine1 || !town || !county || !postcode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists." });
    }

    const user = await prisma.user.create({
      data: {
        id: `usr-${crypto.randomUUID().replace(/-/g, "")}`,
        name,
        email,
        phoneNumber,
        addressLine1,
        addressLine2,
        addressLine3,
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
        line2: user.addressline2,
        line3: user.addressline3,
        town: user.town,
        county: user.county,
        postcode: user.postcode
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.get("/:userId", [requireAuth], async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.headers.authorization?.replace("Bearer dummy-token-", "");

  if (!authenticatedUserId) {
    return res.status(401).json({ message: "Access token is missing or invalid" });
  }

  if (!USER_ID_REGEX.test(userId)) {
    return res.status(400).json({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Access to requested user is forbidden" });
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      createdTimestamp: user.createdTimestamp,
      updatedTimestamp: user.updatedTimestamp,
      address: {
        line1: user.addressLine1,
        line2: user.addressline2,
        line3: user.addressline3,
        town: user.town,
        county: user.county,
        postcode: user.postcode
      }
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.patch("/:userId", [requireAuth], async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.headers.authorization?.replace("Bearer dummy-token-", "");

  if (!authenticatedUserId) {
    return res.status(401).json({ message: "Access token is missing or invalid" });
  }

  if (!/^usr-[A-Za-z0-9]+$/.test(userId)) {
    return res.status(400).json({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
  }

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ message: "Access to requested user is forbidden" });
  }

  const {
    name,
    email,
    phoneNumber,
    addressLine1,
    addressLine2 = "",
    addressLine3 = "",
    town,
    county,
    postcode
  } = req.body;

  if (
    !Object.keys(req.body).length ||
    (!name &&
      !email &&
      !phoneNumber &&
      !town &&
      !county &&
      !postcode &&
      !addressLine1 &&
      !(addressLine2 || addressLine2 === "") &&
      !(addressLine3 || addressLine3 === ""))
  ) {
    return res.status(400).json({ message: "No update fields provided" });
  }

  const updateData = { updatedTimestamp: new Date().toISOString() };
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (phoneNumber) updateData.phoneNumber = phoneNumber;
  if (addressLine1) updateData.addressLine1 = addressLine1;
  if (addressLine2) updateData.addressLine2 = addressLine2;
  if (addressLine3) updateData.addressLine3 = addressLine3;
  if (town) updateData.town = town;
  if (county) updateData.county = county;
  if (postcode) updateData.postcode = postcode;

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    if (!user) {
      return res.status(404).json({ message: "User was not found" });
    }
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
    console.error("Error updating user:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

router.delete("/:userId", [requireAuth], async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.headers.authorization?.replace("Bearer dummy-token-", "");

  if (!authenticatedUserId) {
    return res.status(401).json({ message: "Access token is missing or invalid" });
  }

  if (!USER_ID_REGEX.test(userId)) {
    return res.status(400).json({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
  }

  if (userId !== authenticatedUserId) {
    return res.status(403).json({ message: "Access to requested user is forbidden" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User was not found" });
    }

    if (user.accounts && user.accounts.length > 0) {
      return res.status(409).json({
        message: "A user cannot be deleted when they are associated with a bank account"
      });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    return res.status(204).send();
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
});

export default router;
