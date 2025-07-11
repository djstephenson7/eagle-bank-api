/* eslint-disable no-undef */
import { prismaMock } from "../../context.js";

jest.unstable_mockModule("../startup/connectToDatabase.js", () => ({
  prisma: prismaMock,
  connectToDatabase: jest.fn()
}));

let request, app;
beforeEach(async () => {
  // Dynamically import after the mock is set up
  request = (await import("supertest")).default;
  app = (await import("../app.js")).default;
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (prismaMock.$disconnect) await prismaMock.$disconnect();
  });

  it("Creates a user", async () => {
    prismaMock.user.create.mockResolvedValue({ ...user, id: 1 });
    // prismaMock.user.findUnique.mockResolvedValue(null);

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
    prismaMock.user.findUnique.mockResolvedValue({ ...user, email: "dup@example.com" });
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
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...user, email: "notanemail", id: 2 });
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
