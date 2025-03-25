export interface BatchRequest {
    total_transactions: number;
    total_amount: number;
    duration_seconds: number;
    merchant_id: string;
  }
  
  export interface BatchResponse {
    success_count: number;
    failure_count: number;
    average_response_time: number;
    total_processed_amount: number;
    transactions: any[];
  }