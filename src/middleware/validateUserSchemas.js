import Joi from "joi";

// Create user schema - matches Prisma schema structure
export const createUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required(),
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().allow("").optional().default(""),
  addressLine3: Joi.string().allow("").optional().default(""),
  town: Joi.string().required(),
  county: Joi.string().required(),
  postcode: Joi.string().required()
});

// Update user schema - all fields optional
export const updateUserSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .optional(),
  addressLine1: Joi.string().optional(),
  addressLine2: Joi.string().allow("").optional(),
  addressLine3: Joi.string().allow("").optional(),
  town: Joi.string().optional(),
  county: Joi.string().optional(),
  postcode: Joi.string().optional()
});

// Validation middleware factory
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

    // Replace req.body with validated data
    req.body = value;
    next();
  };
}
