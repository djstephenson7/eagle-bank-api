import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

const connectToDatabase = async () => {
  try {
    await prisma.$connect();
    console.log("Database connection established.");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    // eslint-disable-next-line no-undef
    process.exit(1);
  }
};

export { prisma, connectToDatabase };
export default prisma;
