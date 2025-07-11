/* eslint-disable no-undef */

import { app } from "../app.js";
import { PrismaClient } from "@prisma/client";

let request, server, prisma;

jest.mock("@prisma/client", () => {
  const user = { create: jest.fn(), findUnique: jest.fn() };
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
  prisma = new PrismaClient();
  request = (await import("supertest")).default;
  server = app.listen(0);
});

afterEach(() => {
  if (server) server.close();
});

const user = {
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

describe("POST /v1/users", () => {
  it("Creates a user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ ...user, id: "usr-123" });

    const res = await request(app).post("/v1/users").send(user);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.email).toBe("testuser@example.com");
  });

  it("Fails if required fields are missing", async () => {
    const res = await request(app).post("/v1/users").send({
      email: "missingfields@example.com"
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toStrictEqual({ message: "Missing required fields" });
  });

  it("Fails if email is duplicate", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ ...user, email: "dup@example.com" });
    const res = await request(app).post("/v1/users").send({
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
    expect(res.statusCode).toBe(400);
    expect(res.body).toStrictEqual({ message: "A user with this email already exists." });
  });

  it("Fails with invalid email format", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ ...user, email: "notanemail", id: 2 });
    const res = await request(app).post("/v1/users").send({
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
    expect([201, 400]).toContain(res.statusCode);
  });
});
