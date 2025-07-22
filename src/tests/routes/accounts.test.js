import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { mockLogger } from "pino";
import { app } from "../../app.js";
import { JWT_SECRET } from "../../consts";

let request, server, prisma;

jest.mock("@prisma/client", () => {
  const account = {
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  };
  const user = { findUnique: jest.fn() };
  const transaction = { create: jest.fn() };
  const mockPrisma = {
    account,
    user,
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

const makeJwt = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });

beforeEach(async () => {
  jest.useFakeTimers();
  prisma = new PrismaClient();
  Object.values(prisma.account).forEach((fn) => fn.mockReset());
  Object.values(prisma.user).forEach((fn) => fn.mockReset());
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

const mockUser = {
  id: mockUserId,
  name: "Test User",
  email: "testuser@example.com",
  phoneNumber: "1234567890",
  addressLine1: "1 Test St",
  addressLine2: "",
  addressLine3: "",
  town: "Testville",
  county: "Testshire",
  postcode: "TST 123",
  createdTimestamp: new Date().toISOString(),
  updatedTimestamp: new Date().toISOString()
};

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

describe("v1/accounts", () => {
  describe("POST /", () => {
    it("Creates an account successfully", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(null);
      prisma.account.create.mockResolvedValueOnce(mockAccount);

      await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account", accountType: "personal" })
        .expect(201)
        .expect({
          accountNumber: mockAccount.accountNumber,
          sortCode: mockAccount.sortCode,
          name: mockAccount.name,
          accountType: mockAccount.accountType,
          balance: 0,
          currency: mockAccount.currency,
          createdTimestamp: mockAccount.createdTimestamp,
          updatedTimestamp: mockAccount.updatedTimestamp
        });
    });

    it("Returns 401 if no authorization header is provided", async () => {
      await request(app)
        .post("/v1/accounts")
        .send({ name: "Test Account", accountType: "personal" })
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      await request(app)
        .post("/v1/accounts")
        .set("Authorization", "Invalid-Token")
        .send({ name: "Test Account", accountType: "personal" })
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token is invalid'", async () => {
      await request(app)
        .post("/v1/accounts")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .send({ name: "Test Account", accountType: "personal" })
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 400 if name is missing", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ accountType: "personal" });

      expect(statusCode).toBe(400);
      expect(body).toHaveProperty("message", "Validation failed");
      expect(body).toHaveProperty("details");
      expect(body.details.some((d) => d.field === "name" && d.type === "any.required")).toBe(true);
    });

    it("Returns 400 if accountType is missing", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account" });

      expect(statusCode).toBe(400);
      expect(body).toHaveProperty("message", "Validation failed");
      expect(body).toHaveProperty("details");
      expect(body.details.some((d) => d.field === "accountType" && d.type === "any.required")).toBe(
        true
      );
    });

    it("Returns 400 if accountType is not 'personal'", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account", accountType: "business" });

      expect(statusCode).toBe(400);
      expect(body).toHaveProperty("message", "Validation failed");
      expect(body).toHaveProperty("details");
      expect(body.details.some((d) => d.field === "accountType" && d.type === "any.only")).toBe(
        true
      );
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const message = "Access token is missing or invalid";
      await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account", accountType: "personal" })
        .expect(401)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "UnauthorisedError", message }),
        expect.any(String)
      );
    });

    it("Returns 500 if account number already exists", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);

      await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account", accountType: "personal" })
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Test Account", accountType: "personal" })
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });
  });

  describe("GET /", () => {
    it("Returns accounts list successfully", async () => {
      const mockAccounts = [
        { ...mockAccount, id: 1, accountNumber: "01123456", name: "First Account", balance: 1000 },
        { ...mockAccount, id: 2, accountNumber: "01654321", name: "Second Account", balance: 2500 }
      ];

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findMany.mockResolvedValueOnce(mockAccounts);

      await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200)
        .expect({
          accounts: [
            {
              accountNumber: "01123456",
              sortCode: "10-10-10",
              name: "First Account",
              accountType: "personal",
              balance: 10,
              currency: "GBP",
              createdTimestamp: mockAccount.createdTimestamp,
              updatedTimestamp: mockAccount.updatedTimestamp
            },
            {
              accountNumber: "01654321",
              sortCode: "10-10-10",
              name: "Second Account",
              accountType: "personal",
              balance: 25,
              currency: "GBP",
              createdTimestamp: mockAccount.createdTimestamp,
              updatedTimestamp: mockAccount.updatedTimestamp
            }
          ]
        });
    });

    it("Returns 401 if no authorization header is provided", async () => {
      await request(app)
        .get("/v1/accounts")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      await request(app)
        .get("/v1/accounts")
        .set("Authorization", "Invalid-Token")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token is invalid'", async () => {
      await request(app)
        .get("/v1/accounts")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(401)
        .expect({ message: "Access token is missing or invalid" });
    });

    it("Returns empty accounts array when user has no accounts", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findMany.mockResolvedValueOnce([]);

      await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200)
        .expect({ accounts: [] });
    });

    it("Returns 500 if Prisma throws an error", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Handles accounts with different balance amounts correctly", async () => {
      const mockAccounts = [
        {
          ...mockAccount,
          id: 1,
          accountNumber: "01123456",
          name: "Savings Account",
          balance: 5000
        },
        { ...mockAccount, id: 2, accountNumber: "01654321", name: "Current Account", balance: 1250 }
      ];

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findMany.mockResolvedValueOnce(mockAccounts);

      const { body } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200);

      expect(body.accounts[0].balance).toBe(50);
      expect(body.accounts[1].balance).toBe(12.5);
    });
  });

  describe("GET /:accountNumber", () => {
    it("Returns account details successfully when user owns the account", async () => {
      const mockAccountWithBalance = { ...mockAccount, balance: 15_00 };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountWithBalance);

      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200)
        .expect({
          accountNumber: "01123456",
          sortCode: "10-10-10",
          name: "Test Account",
          accountType: "personal",
          balance: 15,
          currency: "GBP",
          createdTimestamp: mockAccount.createdTimestamp,
          updatedTimestamp: mockAccount.updatedTimestamp
        });
    });

    it("Returns 400 for invalid account number format", async () => {
      const { body } = await request(app)
        .get("/v1/accounts/12345678")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 400 for account number that doesn't start with '01'", async () => {
      const { body } = await request(app)
        .get("/v1/accounts/02123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 400 for account number that's too short", async () => {
      const { body } = await request(app)
        .get("/v1/accounts/0112345")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 400 for account number that's too long", async () => {
      const { body } = await request(app)
        .get("/v1/accounts/011234567")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 401 if no authorization header is provided", async () => {
      await request(app)
        .get("/v1/accounts/01123456")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", "Invalid-Token")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token does not start with 'dummy-token-'", async () => {
      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(401)
        .expect({ message: "Access token is missing or invalid" });
    });

    it("Returns 404 when account is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(null);

      const message = "Bank account not found";
      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(404)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "NotFoundError", message }),
        expect.any(String)
      );
    });

    it("Returns 403 when user tries to access another user's account", async () => {
      const otherUserAccount = { ...mockAccount, userId: "usr-xyz789" };
      const message = "Access forbidden";
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(otherUserAccount);

      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(403)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ForbiddenError", message }),
        expect.any(String)
      );
    });

    it("Handles accounts with zero balance correctly", async () => {
      const mockAccountZeroBalance = { ...mockAccount, balance: 0 };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountZeroBalance);

      const { body } = await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200);

      expect(body.balance).toBe(0);
    });

    it("Handles accounts with decimal balance correctly", async () => {
      const mockAccountDecimalBalance = { ...mockAccount, balance: 12_50 };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccountDecimalBalance);

      const { body } = await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(200);

      expect(body.balance).toBe(12.5);
    });

    it("Returns 500 if Prisma throws an error during user lookup", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during account lookup", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .get("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Validates account number pattern correctly for valid numbers", async () => {
      const validAccountNumbers = ["01123456", "01654321", "01999999", "01000000"];

      for (const accountNumber of validAccountNumbers) {
        prisma.user.findUnique.mockResolvedValueOnce(mockUser);
        prisma.account.findUnique.mockResolvedValueOnce(mockAccount);

        const { statusCode } = await request(app)
          .get(`/v1/accounts/${accountNumber}`)
          .set("Authorization", `Bearer ${makeJwt(mockUserId)}`);

        expect(statusCode).not.toBe(400);
      }
    });

    it("Rejects invalid account number patterns", async () => {
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
          .get(`/v1/accounts/${accountNumber}`)
          .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
          .expect(400);

        expect(body).toHaveProperty("message", "Invalid account number format");
        expect(body).toHaveProperty("details");
        expect(
          body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
        ).toBe(true);
      }
    });
  });

  describe("PATCH /:accountNumber", () => {
    it("Updates account name successfully when user owns the account", async () => {
      const updatedAccount = { ...mockAccount, name: "Updated Account Name" };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.update.mockResolvedValueOnce(updatedAccount);

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Account Name" })
        .expect(200)
        .expect({
          accountNumber: "01123456",
          sortCode: "10-10-10",
          name: "Updated Account Name",
          accountType: "personal",
          balance: 0,
          currency: "GBP",
          createdTimestamp: mockAccount.createdTimestamp,
          updatedTimestamp: updatedAccount.updatedTimestamp
        });
    });

    it("Updates account type successfully when user owns the account", async () => {
      const updatedAccount = { ...mockAccount, accountType: "personal" };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.update.mockResolvedValueOnce(updatedAccount);

      const { body } = await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ accountType: "personal" })
        .expect(200);

      expect(body.accountType).toBe("personal");
    });

    it("Updates both name and account type successfully", async () => {
      const updatedAccount = {
        ...mockAccount,
        name: "Updated Account Name",
        accountType: "personal"
      };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.update.mockResolvedValueOnce(updatedAccount);

      const { body } = await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Account Name", accountType: "personal" })
        .expect(200);

      expect(body.name).toBe("Updated Account Name");
      expect(body.accountType).toBe("personal");
    });

    it("Returns 400 for invalid account number format", async () => {
      const { body } = await request(app)
        .patch("/v1/accounts/12345678")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 400 when no fields are provided for update", async () => {
      const { body } = await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({})
        .expect(400);

      expect(body).toHaveProperty("message", "Validation failed");
      expect(body).toHaveProperty("details");
      expect(body.details.some((d) => d.type === "object.missing")).toBe(true);
    });

    it("Returns 400 when accountType is not 'personal'", async () => {
      const { body } = await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ accountType: "business" })
        .expect(400);

      expect(body).toHaveProperty("message", "Validation failed");
      expect(body).toHaveProperty("details");
      expect(body.details.some((d) => d.field === "accountType" && d.type === "any.only")).toBe(
        true
      );
    });

    it("Returns 401 if no authorization header is provided", async () => {
      await request(app)
        .patch("/v1/accounts/01123456")
        .send({ name: "Updated Name" })
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", "Invalid-Token")
        .send({ name: "Updated Name" })
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token does not start with 'dummy-token-'", async () => {
      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .send({ name: "Updated Name" })
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 401 if user is not found", async () => {
      const message = "Access token is missing or invalid";
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(401)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "UnauthorisedError", message }),
        expect.any(String)
      );
    });

    it("Returns 404 when account is not found", async () => {
      const message = "Bank account not found";
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(404)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "NotFoundError", message }),
        expect.any(String)
      );
    });

    it("Returns 403 when user tries to update another user's account", async () => {
      const otherUserAccount = { ...mockAccount, userId: "usr-xyz789" };
      const message = "Access forbidden";
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(otherUserAccount);

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(403)
        .expect({ message });

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ForbiddenError", message }),
        expect.any(String)
      );
    });

    it("Returns 500 if Prisma throws an error during user lookup", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during account lookup", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during account update", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.update.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .patch("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .send({ name: "Updated Name" })
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });
  });

  describe("DELETE /:accountNumber", () => {
    it("Deletes account successfully when user owns the account", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.delete.mockResolvedValueOnce(mockAccount);

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(204);
    });

    it("Returns 400 for invalid account number format", async () => {
      const { body } = await request(app)
        .delete("/v1/accounts/12345678")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(400);

      expect(body).toHaveProperty("message", "Invalid account number format");
      expect(body).toHaveProperty("details");
      expect(
        body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
      ).toBe(true);
    });

    it("Returns 401 if no authorization header is provided", async () => {
      await request(app)
        .delete("/v1/accounts/01123456")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", "Invalid-Token")
        .expect(401)
        .expect({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token does not start with 'dummy-token-'", async () => {
      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .expect(403)
        .expect({ message: "Invalid token" });
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(401)
        .expect({ message: "Access token is missing or invalid" });
    });

    it("Returns 404 when account is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(null);

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(404)
        .expect({ message: "Bank account not found" });
    });

    it("Returns 403 when user tries to delete another user's account", async () => {
      const otherUserAccount = { ...mockAccount, userId: "usr-xyz789" };

      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(otherUserAccount);

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(403)
        .expect({ message: "Access forbidden" });
    });

    it("Returns 500 if Prisma throws an error during user lookup", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during account lookup", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during account deletion", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
      prisma.account.delete.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      await request(app)
        .delete("/v1/accounts/01123456")
        .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
        .expect(500)
        .expect({ message: "An unexpected error occurred" });
    });

    it("Validates account number pattern correctly for valid numbers", async () => {
      const validAccountNumbers = ["01123456", "01654321", "01999999", "01000000"];

      for (const accountNumber of validAccountNumbers) {
        prisma.user.findUnique.mockResolvedValueOnce(mockUser);
        prisma.account.findUnique.mockResolvedValueOnce(mockAccount);
        prisma.account.delete.mockResolvedValueOnce(mockAccount);

        const { statusCode } = await request(app)
          .delete(`/v1/accounts/${accountNumber}`)
          .set("Authorization", `Bearer ${makeJwt(mockUserId)}`);

        expect(statusCode).not.toBe(400);
      }
    });

    it("Rejects invalid account number patterns", async () => {
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
          .delete(`/v1/accounts/${accountNumber}`)
          .set("Authorization", `Bearer ${makeJwt(mockUserId)}`)
          .expect(400);

        expect(body).toHaveProperty("message", "Invalid account number format");
        expect(body).toHaveProperty("details");
        expect(
          body.details.some((d) => d.field === "accountNumber" && d.type === "string.pattern.base")
        ).toBe(true);
      }
    });
  });
});
