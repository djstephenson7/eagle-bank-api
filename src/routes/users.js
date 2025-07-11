import express from "express";
import { prisma } from "../startup/connectToDatabase.js";

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

export default router;
