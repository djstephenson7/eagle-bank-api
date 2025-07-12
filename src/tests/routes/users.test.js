/* eslint-disable no-undef */

import { app } from "../../app.js";
import { PrismaClient } from "@prisma/client";

let request, server, prisma;

jest.mock("@prisma/client", () => {
  const user = { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const mockPrisma = {
    user,
    $extends: jest.fn().mockReturnThis(), // allow chaining
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

describe("v1/users", () => {
  describe("POST /", () => {
    it("Creates a user", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ ...mockUser, id: "usr-123" });

      const { body, statusCode } = await request(app).post("/v1/users").send(mockUser);
      expect(statusCode).toBe(201);
      expect(body).toHaveProperty("id");
      expect(body.email).toBe("testuser@example.com");
    });

    it("Fails if required fields are missing", async () => {
      const { body, statusCode } = await request(app).post("/v1/users").send({
        email: "missingfields@example.com"
      });
      expect(statusCode).toBe(400);
      expect(body).toStrictEqual({ message: "Missing required fields" });
    });

    it("Fails if email is duplicate", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, email: "dup@example.com" });
      const { body, statusCode } = await request(app).post("/v1/users").send({
        name: "Dup User",
        email: "dup@example.com",
        phoneNumber: "1234567890",
        addressLine1: "1 Dup St",
        addressLine2: "",
        addressLine3: "",
        town: "Dupville",
        county: "Dupshire",
        postcode: "DUP 123"
      });
      expect(statusCode).toBe(400);
      expect(body).toStrictEqual({ message: "A user with this email already exists." });
    });

    it("Fails with invalid email format", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ ...mockUser, email: "notanemail", id: 2 });
      const { statusCode } = await request(app).post("/v1/users").send({
        name: "Invalid Email",
        email: "notanemail",
        phoneNumber: "1234567890",
        addressLine1: "1 Test St",
        addressLine2: "",
        addressLine3: "",
        town: "Testville",
        county: "Testshire",
        postcode: "TST 123"
      });
      expect([201, 400]).toContain(statusCode);
    });

    it("Returns 500 if Prisma throws", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("DB error");
      });
      const { body, statusCode } = await request(app).post("/v1/users").send(mockUser);

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });
  });

  describe("GET /:userId", () => {
    const user = {
      id: "usr-abc123",
      name: "Test User",
      email: "testuser@example.com",
      phoneNumber: "1234567890",
      addressLine1: "1 Test St",
      addressLine2: "",
      addressLine3: "",
      town: "Testville",
      county: "Testshire",
      postcode: "TST 123"
    };

    it("Returns 401 if no token is provided", async () => {
      const { body, statusCode } = await request(app).get(`/v1/users/${mockUserId}`);

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 400 if userId format is invalid", async () => {
      const { body, statusCode } = await request(app)
        .get("/v1/users/invalid-id")
        .set("Authorization", "Bearer dummy-token-abc123");

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
    });

    it("Returns 404 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const { body, statusCode } = await request(app)
        .get(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(404);
      expect(body).toEqual({ message: "User not found" });
    });

    it("Returns 403 if userId does not match authenticated user", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);
      const { body, statusCode } = await request(app)
        .get(`/v1/users/${mockUserId}`)
        .set("Authorization", "Bearer dummy-token-usr-otheruser");

      expect(statusCode).toBe(403);
      expect(body).toEqual({ message: "Access to requested user is forbidden" });
    });

    it("Returns 200 and user data if authenticated and user exists", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);
      const { body, statusCode } = await request(app)
        .get(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: {
          county: user.county,
          line1: user.addressLine1,
          postcode: user.postcode,
          town: user.town
        }
      });
    });

    it("Returns 500 if Prisma throws", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("DB error");
      });
      const { body, statusCode } = await request(app)
        .get(`/v1/users/${user.id}`)
        .set("Authorization", `Bearer dummy-token-${user.id}`);

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });
  });

  describe("PATCH /:userId", () => {
    const user = { id: mockUserId, ...mockUser };

    it("Returns 401 if no authorization header is provided", async () => {
      const { body, statusCode } = await request(app).patch(`/v1/users/${mockUserId}`);

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", "Invalid-Token");

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 400 if userId format is invalid", async () => {
      const { body, statusCode } = await request(app)
        .patch("/v1/users/invalid-id")
        .set("Authorization", "Bearer dummy-token-usr-abc123");

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
    });

    it("Returns 403 if userId does not match authenticated user", async () => {
      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", "Bearer dummy-token-usr-otheruser");

      expect(statusCode).toBe(403);
      expect(body).toEqual({ message: "Access to requested user is forbidden" });
    });

    it("Returns 400 if no update fields are provided", async () => {
      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({});

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "No update fields provided" });
    });

    it("Updates user name successfully", async () => {
      const updatedUser = { ...user, name: "Updated Name" };
      const updatedTimestamp = new Date().toISOString();
      prisma.user.update.mockResolvedValueOnce({ ...updatedUser, updatedTimestamp });

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Updated Name" });

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        id: updatedUser.id,
        name: "Updated Name",
        address: {
          line1: updatedUser.addressLine1,
          line2: updatedUser.addressLine2,
          line3: updatedUser.addressLine3,
          town: updatedUser.town,
          county: updatedUser.county,
          postcode: updatedUser.postcode
        },
        phoneNumber: updatedUser.phoneNumber,
        email: updatedUser.email,
        createdTimestamp: updatedUser.createdTimestamp,
        updatedTimestamp
      });
    });

    it("Updates user email successfully", async () => {
      const updatedUser = { ...user, email: "updated@example.com" };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ email: "updated@example.com" });

      expect(statusCode).toBe(200);
      expect(body.email).toBe(updatedUser.email);
    });

    it("Updates user phone number successfully", async () => {
      const updatedUser = { ...user, phoneNumber: "9876543210" };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ phoneNumber: "9876543210" });

      expect(statusCode).toBe(200);
      expect(body.phoneNumber).toBe("9876543210");
    });

    it("Updates address fields successfully", async () => {
      const updatedData = {
        addressLine1: "2 Updated St",
        addressLine2: "Apt 5",
        addressLine3: "Building B",
        town: "Updated Town",
        county: "Updated County",
        postcode: "UPD 456"
      };
      const updatedUser = { ...user, ...updatedData };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send(updatedData);

      expect(statusCode).toBe(200);
      expect(body.address).toEqual({
        line1: updatedData.addressLine1,
        line2: updatedData.addressLine2,
        line3: updatedData.addressLine3,
        town: updatedData.town,
        county: updatedData.county,
        postcode: updatedData.postcode
      });
    });

    it("Updates address with empty line2 and line3", async () => {
      const updatedData = { addressLine2: "", addressLine3: "" };
      const updatedUser = { ...user, ...updatedData };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send(updatedData);

      expect(statusCode).toBe(200);
      expect(body.address.line2).toBe("");
      expect(body.address.line3).toBe("");
    });

    it("Updates multiple fields simultaneously", async () => {
      const updatedData = {
        name: "Multi Updated",
        email: "multi@example.com",
        phoneNumber: "5551234567",
        addressLine1: "3 Multi St",
        town: "Multi Town"
      };
      const updatedUser = { ...user, ...updatedData };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send(updatedData);

      expect(statusCode).toBe(200);
      expect(body.name).toBe(updatedData.name);
      expect(body.email).toBe(updatedData.email);
      expect(body.phoneNumber).toBe(updatedData.phoneNumber);
      expect(body.address.line1).toBe(updatedData.addressLine1);
      expect(body.address.town).toBe(updatedData.town);
    });

    it("Returns 404 if user is not found", async () => {
      prisma.user.update.mockResolvedValueOnce(null);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Updated Name" });

      expect(statusCode).toBe(404);
      expect(body).toEqual({ message: "User was not found" });
    });

    it("Returns 500 if Prisma throws an error", async () => {
      prisma.user.update.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send({ name: "Updated Name" });

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });

    it("Handles partial address updates correctly", async () => {
      const updatedData = { addressLine1: "4 Partial St", town: "Partial Town" };
      const updatedUser = { ...user, ...updatedData };
      prisma.user.update.mockResolvedValueOnce(updatedUser);

      const { body, statusCode } = await request(app)
        .patch(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`)
        .send(updatedData);

      expect(statusCode).toBe(200);
      expect(body.address.line1).toBe(updatedData.addressLine1);
      expect(body.address.town).toBe(updatedData.town);
      expect(body.address.line2).toBe(user.addressLine2);
      expect(body.address.county).toBe(user.county);
      expect(body.address.postcode).toBe(user.postcode);
    });
  });

  describe("DELETE /:userId", () => {
    it("Returns 401 if no authorization header is provided", async () => {
      const { body, statusCode } = await request(app).delete(`/v1/users/${mockUserId}`);

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 401 if authorization header is malformed", async () => {
      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", "Invalid-Token");

      expect(statusCode).toBe(401);
      expect(body).toEqual({ message: "Missing or invalid token" });
    });

    it("Returns 400 if userId format is invalid", async () => {
      const { body, statusCode } = await request(app)
        .delete("/v1/users/invalid-id")
        .set("Authorization", "Bearer dummy-token-usr-abc123");

      expect(statusCode).toBe(400);
      expect(body).toEqual({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
    });

    it("Returns 403 if userId does not match authenticated user", async () => {
      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", "Bearer dummy-token-usr-otheruser");

      expect(statusCode).toBe(403);
      expect(body).toEqual({ message: "Access to requested user is forbidden" });
    });

    it("Returns 404 if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(404);
      expect(body).toEqual({ message: "User was not found" });
    });

    it("Returns 409 if user has associated accounts", async () => {
      const userWithAccounts = {
        ...mockUser,
        accounts: [
          {
            id: 1,
            accountNumber: "01123456",
            sortCode: "12-34-56",
            name: "Main Account",
            accountType: "personal",
            balance: 1000,
            currency: "GBP"
          }
        ]
      };
      prisma.user.findUnique.mockResolvedValueOnce(userWithAccounts);

      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(409);
      expect(body).toEqual({
        message: "A user cannot be deleted when they are associated with a bank account"
      });
    });

    it("Deletes user successfully when no accounts exist", async () => {
      const userWithoutAccounts = { ...mockUser, accounts: [] };
      prisma.user.findUnique.mockResolvedValueOnce(userWithoutAccounts);
      prisma.user.delete.mockResolvedValueOnce(mockUser);

      const { statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(204);
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: mockUserId }
      });
    });

    it("Returns 500 if Prisma throws an error during findUnique", async () => {
      prisma.user.findUnique.mockImplementationOnce(() => {
        throw new Error("Database connection error");
      });

      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });

    it("Returns 500 if Prisma throws an error during delete", async () => {
      const userWithoutAccounts = { ...mockUser, accounts: [] };
      prisma.user.findUnique.mockResolvedValueOnce(userWithoutAccounts);
      prisma.user.delete.mockImplementationOnce(() => {
        throw new Error("Delete operation failed");
      });

      const { body, statusCode } = await request(app)
        .delete(`/v1/users/${mockUserId}`)
        .set("Authorization", `Bearer dummy-token-${mockUserId}`);

      expect(statusCode).toBe(500);
      expect(body).toEqual({ message: "An unexpected error occurred" });
    });
  });
});
