const Joi = require('joi');

// Transaction request validation schema
const transactionRequestSchema = Joi.object({
  card_number: Joi.string()
    .pattern(/^\d{16}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid card number'
    }),
  
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'Amount must be greater than 0'
    }),
  
  merchant_id: Joi.string()
    .required()
});

// Transaction response structure
class TransactionResponse {
  constructor({ success, message, data, response_code = null, authorization_code = null }) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.response_code = response_code;
    this.authorization_code = authorization_code;
  }
}

module.exports = {
  transactionRequestSchema,
  TransactionResponse,
  validateTransactionRequest: (data) => transactionRequestSchema.validate(data)
};