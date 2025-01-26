export interface ISO8583Message {
  mti: string;
  primaryAccountNumber?: string;
  processingCode: string;
  amount: number;
  transmissionDateTime: string;
  systemTraceNumber: string;
  localTransactionTime: string;
  localTransactionDate: string;
  merchantType: string;
  responseCode?: string;
  terminalId: string;
  merchantId: string;
}

export interface TransactionResponse {
  success: boolean;
  message: string;
  data: ISO8583Message;
  responseCode?: string;
  authorizationCode?: string;
}