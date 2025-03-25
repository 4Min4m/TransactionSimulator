import { BatchRequest, BatchResponse } from "../models/batch";
import { TransactionRequest, TransactionResponse } from "../models/transaction";
import { processTransaction } from "./transactionService";

export const processBatch = async (batch: BatchRequest): Promise<BatchResponse> => {
  const totalTransactions = batch.total_transactions;
  const amountPerTransaction = batch.total_amount / totalTransactions;
  const delayBetweenTransactions = batch.duration_seconds / totalTransactions;

  let successCount = 0;
  let failureCount = 0;
  let totalResponseTime = 0;
  let totalProcessedAmount = 0;
  const transactions: TransactionResponse[] = [];

  for (let i = 0; i < totalTransactions; i++) {
    const startTime = Date.now();

    const transaction: TransactionRequest = {
      card_number: "4111111111111111",
      amount: amountPerTransaction,
      merchant_id: batch.merchant_id,
    };

    const response = await processTransaction(transaction);
    if (response.success) {
      successCount++;
      totalProcessedAmount += amountPerTransaction;
    } else {
      failureCount++;
    }

    transactions.push(response);
    totalResponseTime += Date.now() - startTime;

    // delay between transactions
    await new Promise((resolve) => setTimeout(resolve, delayBetweenTransactions * 1000));
  }

  return {
    success_count: successCount,
    failure_count: failureCount,
    average_response_time: totalResponseTime / totalTransactions,
    total_processed_amount: totalProcessedAmount,
    transactions,
  };
};