import { TransactionRequest, TransactionResponse } from "../models/transaction";
import { supabase } from "../utils/supabaseClient";

const generateISO8583Message = (transaction: TransactionRequest, responseCode: string) => {
  const now = new Date();
  return {
    mti: "0110",
    primaryAccountNumber: transaction.card_number,
    processingCode: "000000",
    amount: transaction.amount,
    transmissionDateTime: now.toISOString().replace(/[-:T.]/g, "").slice(0, 14),
    systemTraceNumber: Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString(),
    localTransactionTime: now.toTimeString().slice(0, 8),
    localTransactionDate: now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    merchantType: "5999",
    responseCode: responseCode,
    terminalId: "TERM001",
    merchantId: transaction.merchant_id,
  };
};

export const processTransaction = async (transaction: TransactionRequest): Promise<TransactionResponse> => {
  // simulating delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 900 + 100));

  // aprrove logic
  const isApproved = Math.random() < 0.9; // 90% success
  const responseCode = isApproved ? "00" : "05";
  const authorizationCode = isApproved
    ? Array(6)
        .fill(0)
        .map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(Math.floor(Math.random() * 36)))
        .join("")
    : undefined;

  // generating ISO 8583 message
  const iso8583Message = generateISO8583Message(transaction, responseCode);

  // Supabase data generation
  const transactionData = {
    card_number: transaction.card_number,
    amount: transaction.amount,
    merchant_id: transaction.merchant_id,
    status: isApproved ? "APPROVED" : "DECLINED",
    type: "PURCHASE",
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    iso8583_message: iso8583Message,
  };

  // insert into Supabase
  await supabase.from("transactions").insert(transactionData).select();

  return {
    success: isApproved,
    message: isApproved ? "Transaction approved" : "Transaction declined",
    data: transaction,
    response_code: responseCode,
    authorization_code: authorizationCode,
  };
};