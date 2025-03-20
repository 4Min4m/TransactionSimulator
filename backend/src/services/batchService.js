const { processTransaction } = require('./transactionService');
const { BatchResponse } = require('../models/Batch');

/**
 * Process a batch of transactions
 * @param {Object} batch - Batch request data
 * @returns {Promise<BatchResponse>} Batch response
 */
async function processBatch(batch) {
  const totalTransactions = batch.total_transactions;
  const amountPerTransaction = batch.total_amount / totalTransactions;
  const delayBetweenTransactions = batch.duration_seconds / totalTransactions * 1000; // Convert to ms
  
  let successCount = 0;
  let failureCount = 0;
  let totalResponseTime = 0;
  let totalProcessedAmount = 0;
  const transactions = [];
  
  for (let i = 0; i < totalTransactions; i++) {
    const startTime = Date.now();
    
    // Create transaction request
    const transaction = {
      card_number: "4111111111111111", // Mock card number
      amount: amountPerTransaction,
      merchant_id: batch.merchant_id
    };
    
    // Process transaction
    const response = await processTransaction(transaction);
    
    if (response.success) {
      successCount += 1;
      totalProcessedAmount += amountPerTransaction;
    } else {
      failureCount += 1;
    }
    
    transactions.push(response);
    totalResponseTime += (Date.now() - startTime) / 1000; // Convert to seconds
    
    // Add delay between transactions
    if (i < totalTransactions - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenTransactions));
    }
  }
  
  return new BatchResponse({
    success_count: successCount,
    failure_count: failureCount,
    average_response_time: totalResponseTime / totalTransactions,
    total_processed_amount: totalProcessedAmount,
    transactions: transactions
  });
}

module.exports = {
  processBatch
};