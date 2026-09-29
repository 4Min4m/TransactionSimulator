// Shapes returned by the API (see lambda/payments.js and lambda/iso8583.js).

export interface StoredIsoMessage {
  mti: string;
  /** Packed ASCII message (MTI + bitmap + fields), PAN masked. */
  raw: string;
  /** Field number + name -> value, e.g. { "39 responseCode": "00" }. */
  fields: Record<string, string>;
}

export interface Transaction {
  id: number;
  order_id: string | null;
  merchant_id: string;
  batch_id: string | null;
  amount: number;
  currency: string;
  card_number: string; // always masked
  card_scheme: string | null;
  type: string;
  status: "APPROVED" | "DECLINED";
  response_code: string | null;
  authorization_code: string | null;
  processing_ms: number | null;
  iso8583_message: { request: StoredIsoMessage; response: StoredIsoMessage } | null;
  created_at: string;
}

export interface TransactionResponse {
  success: boolean;
  message: string;
  responseCode: string;
  responseMessage: string;
  authorizationCode: string | null;
  idempotentReplay: boolean;
  data: Transaction;
}

// Luhn-valid test PANs and the ISO 8583 response code each one produces
// (mirrors lambda/authorization.js).
export const TEST_CARDS: { pan: string; label: string }[] = [
  { pan: "4111111111111111", label: "Visa — approved (00)" },
  { pan: "5555555555554444", label: "Mastercard — approved (00)" },
  { pan: "378282246310005", label: "Amex — approved (00)" },
  { pan: "4000000000000002", label: "Do not honor (05)" },
  { pan: "4000000000009995", label: "Insufficient funds (51)" },
  { pan: "4000000000000069", label: "Expired card (54)" },
  { pan: "4000000000000259", label: "Suspected fraud (59)" },
  { pan: "4000000000000119", label: "System malfunction (96)" },
  { pan: "4111111111111112", label: "Fails Luhn check (14)" },
];
