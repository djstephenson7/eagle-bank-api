import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@example.com",
      phoneNumber: "1234567890",
      addressLine1: "1 High St",
      addressLine2: "",
      addressLine3: "",
      town: "London",
      county: "Greater London",
      postcode: "E1 1AA",
      accounts: {
        create: {
          accountNumber: "12345678",
          sortCode: "10-10-10",
          name: "Main Account",
          accountType: "personal",
          balance: 10000,
          currency: "GBP"
        }
      }
    }
  });

  console.log(user);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });
