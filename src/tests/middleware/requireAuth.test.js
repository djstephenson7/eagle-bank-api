import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../consts";
import { requireAuth } from "../../middleware";

describe("requireAuth", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it("returns 401 if no Authorization header", () => {
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing or invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 if Authorization header does not start with 'Bearer '", () => {
    req.headers.authorization = "Token abc";
    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing or invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 403 if token is invalid (bad signature)", () => {
    const badToken = jwt.sign({ userId: "abc123" }, "wrong-secret");
    req.headers.authorization = `Bearer ${badToken}`;
    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 403 if token is expired", () => {
    const expiredToken = jwt.sign({ userId: "abc123" }, JWT_SECRET, { expiresIn: -1 });
    req.headers.authorization = `Bearer ${expiredToken}`;
    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next if token is valid", () => {
    const validToken = jwt.sign({ userId: "abc123" }, JWT_SECRET, { expiresIn: "1h" });
    req.headers.authorization = `Bearer ${validToken}`;
    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(req.authenticatedUserId).toBe("abc123");
  });
});
