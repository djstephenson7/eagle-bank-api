import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const user1 = await prisma.user.create({
    data: {
      id: "usr-alice123",
      name: "Alice Smith",
      email: "alice@example.com",
      phoneNumber: "+441234567890",
      addressLine1: "1 Main St",
      addressLine2: "",
      addressLine3: "",
      town: "London",
      county: "Greater London",
      postcode: "E1 6AN",
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });
  const user2 = await prisma.user.create({
    data: {
      id: "usr-bob456",
      name: "Bob Jones",
      email: "bob@example.com",
      phoneNumber: "+441234567891",
      addressLine1: "2 High St",
      addressLine2: "Apt 4",
      addressLine3: "",
      town: "Manchester",
      county: "Greater Manchester",
      postcode: "M1 2AB",
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });

  // Create accounts for Alice
  await prisma.account.create({
    data: {
      accountNumber: "01111111",
      sortCode: "10-10-10",
      name: "Alice's Main Account",
      accountType: "personal",
      balance: 500_00, // £500.00
      currency: "GBP",
      userId: user1.id,
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });
  await prisma.account.create({
    data: {
      accountNumber: "01111112",
      sortCode: "10-10-10",
      name: "Alice's Savings",
      accountType: "personal",
      balance: 2_500_00, // £2,500.00
      currency: "GBP",
      userId: user1.id,
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });

  // Create accounts for Bob
  await prisma.account.create({
    data: {
      accountNumber: "01222221",
      sortCode: "10-10-10",
      name: "Bob's Main Account",
      accountType: "personal",
      balance: 100_00, // £100.00
      currency: "GBP",
      userId: user2.id,
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });
  await prisma.account.create({
    data: {
      accountNumber: "01222222",
      sortCode: "10-10-10",
      name: "Bob's Savings",
      accountType: "personal",
      balance: 500_00, // £500.00
      currency: "GBP",
      userId: user2.id,
      createdTimestamp: new Date().toISOString(),
      updatedTimestamp: new Date().toISOString()
    }
  });

  console.log("Seed complete: 2 users and 4 accounts created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
