import pino from "pino";

const logger = pino();

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);

    logger.error(
      {
        name: this.name,
        message: this.message,
        status: this.status,
        stack: this.stack
      },
      `AppError created: ${this.name}`
    );
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
  }
}

export class UnauthorisedError extends AppError {
  constructor(message = "Access token is missing or invalid") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}
