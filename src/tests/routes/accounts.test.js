/* eslint-disable no-undef */

import { app } from "../../app.js";
import { PrismaClient } from "@prisma/client";

let request, server, prisma;

jest.mock("@prisma/client", () => {
  const account = { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() };
  const user = { findUnique: jest.fn() };
  const mockPrisma = {
    account,
    user,
    $extends: jest.fn().mockReturnThis(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined)
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

beforeEach(async () => {
  jest.useFakeTimers();
  prisma = new PrismaClient();
  Object.values(prisma.account).forEach((fn) => fn.mockReset());
  Object.values(prisma.user).forEach((fn) => fn.mockReset());
  request = (await import("supertest")).default;
  server = app.listen(0);
});

afterEach(() => {
  jest.useRealTimers();
  if (server) server.close();
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

      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({
          name: "Test Account",
          accountType: "personal"
        });

      expect(statusCode).toBe(201);
      expect(body).toEqual({
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
      const { body, statusCode } = await request(app).post("/v1/accounts").send({
        name: "Test Account",
        accountType: "personal"
      });

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", "Invalid-Token")
        .send({ name: "Test Account", accountType: "personal" });

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token does not start with 'dummy-token-'", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", "Bearer notdummy-usr-abc123")
        .send({ name: "Test Account", accountType: "personal" });

      expect(statusCode).toBe(403);
      expect(body).toEqual({ message: "Invalid token" });
    });

    it("Returns 400 if name is missing", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ accountType: "personal" });

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Missing required fields: name and accountType" });
    });

    it("Returns 400 if accountType is missing", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Test Account" });

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Missing required fields: name and accountType" });
    });

    it("Returns 400 if accountType is not 'personal'", async () => {
      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Test Account", accountType: "business" });

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Invalid accountType. Must be 'personal'" });
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Test Account", accountType: "personal" });

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Access token is missing or invalid" });
    });

    it("Returns 500 if account number already exists", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findUnique.mockResolvedValueOnce(mockAccount);

      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Test Account", accountType: "personal" });

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      const { body, statusCode } = await request(app)
        .post("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({
          name: "Test Account",
          accountType: "personal"
        });

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
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

      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(200);
      expect(body).toEqual({
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
      const { body, statusCode } = await request(app).get("/v1/accounts");

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", "Invalid-Token");

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 403 if token does not start with 'dummy-token-'", async () => {
      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", "Bearer notdummy-usr-abc123");

      expect(statusCode).toBe(403);
      expect(body).toEqual({ message: "Invalid token" });
    });

    it("Returns 401 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Access token is missing or invalid" });
    });

    it("Returns empty accounts array when user has no accounts", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser);
      prisma.account.findMany.mockResolvedValueOnce([]);

      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(200);
      expect(body).toEqual({ accounts: [] });
    });

    it("Returns 500 if Prisma throws an error", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
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

      const { body, statusCode } = await request(app)
        .get("/v1/accounts")
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(200);
      expect(body.accounts[0].balance).toBe(50);
      expect(body.accounts[1].balance).toBe(12.5);
    });
  });
});
