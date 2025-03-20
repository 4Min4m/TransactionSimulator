const Joi = require('joi');

// Batch request validation schema
const batchRequestSchema = Joi.object({
  total_transactions: Joi.number()
    .integer()
    .positive()
    .required(),
  
  total_amount: Joi.number()
    .positive()
    .required(),
  
  duration_seconds: Joi.number()
    .integer()
    .positive()
    .required(),
  
  merchant_id: Joi.string()
    .required()
});

// Batch response structure
class BatchResponse {
  constructor({ success_count, failure_count, average_response_time, total_processed_amount, transactions }) {
    this.success_count = success_count;
    this.failure_count = failure_count;
    this.average_response_time = average_response_time;
    this.total_processed_amount = total_processed_amount;
    this.transactions = transactions;
  }
}

module.exports = {
  batchRequestSchema,
  BatchResponse,
  validateBatchRequest: (data) => batchRequestSchema.validate(data)
};