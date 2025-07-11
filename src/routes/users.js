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
      addressLine2,
      addressLine3,
      town,
      county,
      postcode
    } = req.body;

    if (!name || !email || !phoneNumber || !addressLine1 || !town || !county || !postcode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check for duplicate email
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
        addressLine2: addressLine2 || "",
        addressLine3: addressLine3 || "",
        town,
        county,
        postcode
      }
    });
    return res.status(201).json(user);
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
      address: user.address
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "An unexpected error occurred" });
  }
});

export default router;
