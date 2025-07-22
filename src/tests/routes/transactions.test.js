import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { mockLogger } from "pino";
import { app } from "../../app.js";
import { JWT_SECRET } from "../../consts";

let request, server, prisma;

const makeJwt = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });

jest.mock("@prisma/client", () => {
  const account = {
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  };

  const transaction = { create: jest.fn() };
  const mockPrisma = {
    account,
    transaction,
    $extends: jest.fn().mockReturnThis(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn()
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

beforeEach(async () => {
  jest.useFakeTimers();
  prisma = new PrismaClient();
  Object.values(prisma.account).forEach((fn) => fn.mockReset());
  Object.values(prisma.transaction).forEach((fn) => fn.mockReset());
  prisma.$transaction.mockReset();
  request = (await import("supertest")).default;
  server = app.listen(0);
  mockLogger.mockClear();
});

afterEach(async () => {
  jest.useRealTimers();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

const mockUserId = "usr-abc123";

const mockAccount = {
  id: 1,
  accountNumber: "01123456",
  sortCode: "10-10-10",
  name: "Test Account",
  accountType: "personal",
  balance: 0,
  currency: "GBP",
  userId: mockUserId,
  createdTimestamp: new Date().toISOString(),
  updatedTimestamp: new Date().toISOString()
};
describe("/v1/accounts/:accountNumber/transactions", () => {
  describe("POST /", () => {
    const mockTransaction = {
      id: "tan-abc123def456",
      amount: 1000,
      currency: "GBP",
      type: "deposit",
      reference: "Test transaction",
      userId: mockUserId,
      accountId: 1,
      createdTimestamp: new Date().toISOString()
    };

    const mockAccountWithBalance = { ...mockAccount, balance: 5_000 };

    it("Creates a deposit transaction successfully", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 6_000 }, // Updated account
        mockTransaction
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "deposit",
          reference: "Test transaction"
        })
        .expect(201)
        .expect({
          id: mockTransaction.id,
          amount: 1000,
          currency: mockTransaction.currency,
          type: mockTransaction.type,
          reference: mockTransaction.reference,
          userId: mockTransaction.userId,
          createdTimestamp: mockTransaction.createdTimestamp
        });

      expect(prisma.$transaction).toHaveBeenCalledWith([
        prisma.account.update({
          where: { accountNumber: "01123456" },
          data: { balance: 6_000, updatedTimestamp: expect.any(String) }
        }),
        prisma.transaction.create({
          data: {
            id: expect.stringMatching(/^tan-[a-f0-9]{16}$/),
            amount: 1000,
            currency: "GBP",
            type: "deposit",
            reference: "Test transaction",
            userId: mockUserId,
            accountId: 1,
            createdTimestamp: expect.any(String)
          }
        })
      ]);
    });

    it("Creates a withdrawal transaction successfully", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 4_000 },
        mockTransaction
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "withdrawal",
          reference: "Test withdrawal"
        })
        .expect(201)
        .expect({
          id: mockTransaction.id,
          amount: 1000,
          currency: mockTransaction.currency,
          type: mockTransaction.type,
          reference: mockTransaction.reference,
          userId: mockTransaction.userId,
          createdTimestamp: mockTransaction.createdTimestamp
        });
    });

    it("Creates transaction without reference when not provided", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 6000 },
        { ...mockTransaction, reference: "" }
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "deposit"
        })
        .expect(201)
        .expect((res) => expect(res.body.reference).toBe(""));
    });

    it("Returns 404 when account does not exist", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "deposit",
          reference: "Test transaction"
        })
        .expect(404)
        .expect({ message: "Bank account was not found" });
    });

    it("Returns 403 when user does not own the account", async () => {
      const otherUserAccount = { ...mockAccountWithBalance, userId: "usr-xyz789" };
      prisma.account.findUnique.mockResolvedValueOnce(otherUserAccount);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "deposit",
          reference: "Test transaction"
        })
        .expect(403)
        .expect({ message: "Access forbidden" });
    });

    it("Returns 422 when insufficient funds for withdrawal", async () => {
      const accountWithLowBalance = { ...mockAccountWithBalance, balance: 500 }; // £5.00
      prisma.account.findUnique.mockResolvedValueOnce(accountWithLowBalance);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "withdrawal",
          reference: "Test withdrawal"
        })
        .expect(422)
        .expect({ message: "Insufficient funds to process transaction" });
    });

    it("Allows withdrawal when amount equals balance exactly", async () => {
      const accountWithExactBalance = { ...mockAccountWithBalance, balance: 1000 }; // £10.00
      prisma.account.findUnique.mockResolvedValueOnce(accountWithExactBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...accountWithExactBalance, balance: 0 }, // Updated account
        mockTransaction
      ]);

      const response = await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "withdrawal",
          reference: "Test withdrawal"
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: mockTransaction.id,
        amount: 1000,
        currency: mockTransaction.currency,
        type: mockTransaction.type,
        reference: mockTransaction.reference,
        userId: mockTransaction.userId,
        createdTimestamp: mockTransaction.createdTimestamp
      });
    });

    it("Allows withdrawal when sufficient funds are available", async () => {
      const accountWithSufficientBalance = { ...mockAccountWithBalance, balance: 1500 }; // £15.00
      prisma.account.findUnique.mockResolvedValueOnce(accountWithSufficientBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...accountWithSufficientBalance, balance: 500 },
        mockTransaction
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: 1000,
          currency: "GBP",
          type: "withdrawal",
          reference: "Test withdrawal"
        })
        .expect(201);
    });

    it("Validates required fields", async () => {
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({})
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000 })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP" })
        .expect(400);
    });

    it("Validates amount field", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: -1000, currency: "GBP", type: "deposit" })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 0, currency: "GBP", type: "deposit" })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: "invalid", currency: "GBP", type: "deposit" })
        .expect(400);

      // Test minimum amount of £0.01
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 0, currency: "GBP", type: "deposit" })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 0.009, currency: "GBP", type: "deposit" })
        .expect(400);

      // Test that 1 penny is accepted (validation passes, but account doesn't exist)
      prisma.account.findUnique.mockResolvedValue(null);
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1, currency: "GBP", type: "deposit" })
        .expect(404); // Validation passes, but account doesn't exist
    });

    it("Validates currency field", async () => {
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "USD", type: "deposit" })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "EUR", type: "deposit" })
        .expect(400);
    });

    it("Validates transaction type field", async () => {
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP", type: "transfer" })
        .expect(400);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP", type: "payment" })
        .expect(400);
    });

    it("Validates account number pattern", async () => {
      const invalidAccountNumbers = [
        "00123456", // doesn't start with 01
        "02123456", // doesn't start with 01
        "0112345", // too short
        "011234567", // too long
        "0112345a", // contains non-digit
        "0112345A", // contains uppercase letter
        "0112345 ", // contains space
        "0112345-", // contains special character
        "01 12345", // contains space
        "01-12345" // contains dash
      ];

      for (const accountNumber of invalidAccountNumbers) {
        const { body } = await request(app)
          .post(`/v1/accounts/${accountNumber}/transactions`)
          .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
          .send({ amount: 1000, currency: "GBP", type: "deposit" })
          .expect(400);

        expect(body).toHaveProperty("message", "Invalid account number format");
        expect(body).toHaveProperty("details");
        expect(
          body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
        ).toBe(true);
      }
    });

    it("Returns 401 when no authorization header is provided", async () => {
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .send({ amount: 1000, currency: "GBP", type: "deposit" })
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 when invalid JWT token is provided", async () => {
      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", "Bearer invalid-token")
        .send({ amount: 1000, currency: "GBP", type: "deposit" })
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 401 when expired JWT token is provided", async () => {
      const expiredToken = jwt.sign({ userId: mockUserId }, JWT_SECRET, { expiresIn: "0s" });

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ amount: 1000, currency: "GBP", type: "deposit" })
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Handles decimal amounts correctly", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 5250 }, // £52.50
        { ...mockTransaction, amount: 250 } // £2.50
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 2.5, currency: "GBP", type: "deposit", reference: "Test decimal amount" })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(2.5);
        });
    });

    it("Handles large amounts correctly", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 15000 }, // £150.00
        { ...mockTransaction, amount: 10000 } // £100.00
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 100.0, currency: "GBP", type: "deposit", reference: "Test large amount" })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(100.0);
        });
    });

    it("Returns 500 when database transaction fails", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockImplementationOnce(() => {
        throw new Error("Database transaction failed");
      });

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP", type: "deposit", reference: "Test transaction" })
        .expect(500);
    });

    it("Returns 500 when account lookup fails", async () => {
      prisma.account.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP", type: "deposit", reference: "Test transaction" })
        .expect(500);
    });

    it("Generates unique transaction IDs", async () => {
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: 6000 },
        { ...mockTransaction, id: "tan-abc123def4567890" }
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ amount: 1000, currency: "GBP", type: "deposit", reference: "Test transaction" })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toMatch(/^tan-[a-f0-9]{16}$/);
        });
    });

    it("Updates account balance correctly for deposit", async () => {
      const initialBalance = 5000; // £50.00
      const depositAmount = 25.5; // £25.50
      const expectedNewBalance = 7550; // £75.50

      prisma.account.findUnique.mockResolvedValueOnce({
        ...mockAccountWithBalance,
        balance: initialBalance
      });
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: expectedNewBalance },
        mockTransaction
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: depositAmount,
          currency: "GBP",
          type: "deposit",
          reference: "Test deposit"
        })
        .expect(201);

      expect(prisma.$transaction).toHaveBeenCalledWith([
        prisma.account.update({
          where: { accountNumber: "01123456" },
          data: {
            balance: expectedNewBalance,
            updatedTimestamp: expect.any(String)
          }
        }),
        prisma.transaction.create({
          data: {
            id: expect.stringMatching(/^tan-[a-f0-9]{16}$/),
            amount: Math.round(depositAmount * 100),
            currency: "GBP",
            type: "deposit",
            reference: "Test deposit",
            userId: mockUserId,
            accountId: 1,
            createdTimestamp: expect.any(String)
          }
        })
      ]);
    });

    it("Updates account balance correctly for withdrawal", async () => {
      const initialBalance = 5_000; // £50.00
      const withdrawalAmount = 15.75; // £15.75
      const expectedNewBalance = 3425; // £34.25

      prisma.account.findUnique.mockResolvedValueOnce({
        ...mockAccountWithBalance,
        balance: initialBalance
      });
      prisma.$transaction.mockResolvedValueOnce([
        { ...mockAccountWithBalance, balance: expectedNewBalance },
        mockTransaction
      ]);

      await request(app)
        .post("/v1/accounts/01123456/transactions")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({
          amount: withdrawalAmount,
          currency: "GBP",
          type: "withdrawal",
          reference: "Test withdrawal"
        })
        .expect(201);

      expect(prisma.$transaction).toHaveBeenCalledWith([
        prisma.account.update({
          where: { accountNumber: "01123456" },
          data: {
            balance: expectedNewBalance,
            updatedTimestamp: expect.any(String)
          }
        }),
        prisma.transaction.create({
          data: {
            id: expect.stringMatching(/^tan-[a-f0-9]{16}$/),
            amount: Math.round(withdrawalAmount * 100),
            currency: "GBP",
            type: "withdrawal",
            reference: "Test withdrawal",
            userId: mockUserId,
            accountId: 1,
            createdTimestamp: expect.any(String)
          }
        })
      ]);
    });
  });
});
