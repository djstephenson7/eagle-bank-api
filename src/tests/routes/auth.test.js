/* eslint-disable no-undef */
import { PrismaClient } from "@prisma/client";
import { app } from "../../app.js";

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
  id: 1,
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

describe("POST /v1/auth", () => {
  it("Fails if email is missing", async () => {
    const res = await request(app).post("/v1/auth").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toStrictEqual({ message: "Email is required" });
  });

  it("Fails if user is not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/v1/auth").send({ email: "notfound@example.com" });

    expect(res.statusCode).toBe(401);
    expect(res.body).toStrictEqual({ message: "User not found" });
  });

  it("Returns dummy token for valid user", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const res = await request(app).post("/v1/auth").send({ email: user.email });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.token).toBe(`dummy-token-${user.id}`);
  });
});
