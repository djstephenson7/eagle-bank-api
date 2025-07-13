import { requireAuth } from "../../middleware/requireAuth.js";

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

  it("returns 403 if token does not start with 'dummy-token-'", () => {
    req.headers.authorization = "Bearer notdummy-123";
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next if token is valid", () => {
    req.headers.authorization = "Bearer dummy-token-abc123";
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
