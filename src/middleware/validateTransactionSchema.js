import Joi from "joi";

export const createTransactionSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  currency: Joi.string().valid("GBP").required(),
  type: Joi.string().valid("deposit", "withdrawal").required(),
  reference: Joi.string().optional()
});
