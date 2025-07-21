import { validateUserAccess } from "../../middleware/validateUserAccess";

const mockUserId = "usr-abc123";

describe("validateUserAccess", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it("Returns 400 if userId format is invalid", () => {
    req.params.userId = "invalid-user-id";

    validateUserAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid user ID format. Expected usr-<alphanumeric>"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 400 if userId is missing", () => {
    validateUserAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid user ID format. Expected usr-<alphanumeric>"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 400 if userId does not match usr- pattern", () => {
    req.params.userId = "user-abc123";
    validateUserAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid user ID format. Expected usr-<alphanumeric>"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 400 if userId contains invalid characters", () => {
    req.params.userId = "usr-abc@123";
    req.headers.authorization = "Bearer dummy-token-usr-abc@123";
    validateUserAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid user ID format. Expected usr-<alphanumeric>"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("Returns 403 if authenticated user does not match requested user", () => {
    req.params.userId = mockUserId;
    req.headers.authorization = "Bearer dummy-token-usr-def456";
    validateUserAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Access to requested user is forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("Calls next if authentication and authorization are valid", () => {
    req.params.userId = mockUserId;
    req.authenticatedUserId = mockUserId;
    validateUserAccess(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("Calls next for valid userId with numbers only", () => {
    req.params.userId = "usr-123456";
    req.authenticatedUserId = "usr-123456";
    validateUserAccess(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("Calls next for valid userId with mixed alphanumeric", () => {
    req.params.userId = "usr-abc123def";
    req.authenticatedUserId = "usr-abc123def";
    validateUserAccess(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
