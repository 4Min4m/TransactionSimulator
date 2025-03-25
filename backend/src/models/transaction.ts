export interface TransactionRequest {
    card_number: string;
    amount: number;
    merchant_id: string;
  }
  
  export interface TransactionResponse {
    success: boolean;
    message: string;
    data: any; // change to ISO 8583 later
    response_code?: string;
    authorization_code?: string;
  }