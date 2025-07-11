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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (prismaMock.$disconnect) await prismaMock.$disconnect();
  });

  it("Fails if email is missing", async () => {
    const res = await request(app).post("/v1/auth").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toStrictEqual({ message: "Email is required" });
  });

  it("Fails if user is not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/v1/auth").send({ email: "notfound@example.com" });

    expect(res.statusCode).toBe(401);
    expect(res.body).toStrictEqual({ message: "User not found" });
  });

  it("Returns dummy token for valid user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await request(app).post("/v1/auth").send({ email: user.email });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.token).toBe(`dummy-token-${user.id}`);
  });
});
