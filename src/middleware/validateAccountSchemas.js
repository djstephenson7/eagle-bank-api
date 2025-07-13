import Joi from "joi";

export const createAccountSchema = Joi.object({
  name: Joi.string().required(),
  accountType: Joi.string().valid("personal").required()
});

export const updateAccountSchema = Joi.object({
  name: Joi.string().optional(),
  accountType: Joi.string().valid("personal").optional()
}).or("name", "accountType"); // At least one must be present

export const accountNumberParamSchema = Joi.object({
  accountNumber: Joi.string()
    .pattern(/^01\d{6}$/)
    .required()
});

export function validateSchema(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        type: detail.type
      }));
      return res.status(400).json({ message: "Validation failed", details });
    }
    req.body = value;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });
    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        type: detail.type
      }));
      return res.status(400).json({ message: "Invalid account number format", details });
    }
    req.params = value;
    next();
  };
}
