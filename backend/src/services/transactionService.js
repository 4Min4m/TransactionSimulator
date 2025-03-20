const { TransactionResponse } = require('../models/Transaction');
const supabase = require('../config/supabaseClient');

/**
 * Generate an ISO8583 message based on transaction data
 * @param {Object} transaction - Transaction data
 * @param {String} responseCode - Response code
 * @returns {Object} ISO8583 message
 */
function generateIso8583Message(transaction, responseCode) {
  const now = new Date();
  
  return {
    mti: "0110", // Message Type Indicator
    primaryAccountNumber: transaction.card_number,
    processingCode: "000000", // Example processing code
    amount: transaction.amount,
    transmissionDateTime: now.toISOString().replace(/[-:T.Z]/g, '').substring(0, 14),
    systemTraceNumber: Math.floor(100000 + Math.random() * 900000).toString(), // Random 6-digit number
    localTransactionTime: now.toLocaleTimeString('en-US'),
    localTransactionDate: now.toLocaleDateString('en-US'),
    merchantType: "5999", // Example merchant type
    responseCode: responseCode,
    terminalId: "TERM001", // Example terminal ID
    merchantId: transaction.merchant_id
  };
}

/**
 * Process a transaction
 * @param {Object} transaction - Transaction request data
 * @returns {Promise<TransactionResponse>} Transaction response
 */
async function processTransaction(transaction) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 900 + 100)); // 100-1000ms

  // Simple validation and approval logic
  const isApproved = Math.random() < 0.9; // 90% success rate
  const responseCode = isApproved ? "00" : "05";
  const authorizationCode = isApproved 
    ? Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join('')
    : null;

  // Generate ISO 8583 message
  const iso8583Message = generateIso8583Message(transaction, responseCode);

  const now = new Date().toISOString();
  
  // Prepare transaction data for Supabase
  const transactionData = {
    card_number: transaction.card_number,
    amount: transaction.amount,
    merchant_id: transaction.merchant_id,
    status: isApproved ? "APPROVED" : "DECLINED",
    type: "PURCHASE",
    timestamp: now,
    created_at: now,
    updated_at: now,
    iso8583_message: iso8583Message
  };

  // Store transaction in Supabase
  try {
    await supabase.from("transactions").insert(transactionData);
  } catch (error) {
    console.error("Error storing transaction:", error);
    // Continue even if storage fails
  }

  return new TransactionResponse({
    success: isApproved,
    message: isApproved ? "Transaction approved" : "Transaction declined",
    data: transaction,
    response_code: responseCode,
    authorization_code: authorizationCode
  });
}

module.exports = {
  processTransaction,
  generateIso8583Message
};