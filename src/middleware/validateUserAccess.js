const USER_ID_REGEX = /^usr-[A-Za-z0-9]+$/;

export const validateUserAccess = (req, res, next) => {
  const { userId } = req.params;

  if (!USER_ID_REGEX.test(userId)) {
    return res.status(400).json({ message: "Invalid user ID format. Expected usr-<alphanumeric>" });
  }

  if (userId !== req.authenticatedUserId) {
    return res.status(403).json({ message: "Access to requested user is forbidden" });
  }

  next();
};
