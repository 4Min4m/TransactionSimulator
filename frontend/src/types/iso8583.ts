// ISO 8583 Message Type Indicators (MTI)
export enum MTI {
  AUTHORIZATION_REQUEST = '0100',
  AUTHORIZATION_RESPONSE = '0110',
  FINANCIAL_REQUEST = '0200',
  FINANCIAL_RESPONSE = '0210',
  REVERSAL_REQUEST = '0400',
  REVERSAL_RESPONSE = '0410',
}

// Basic ISO 8583 message structure
export interface ISO8583Message {
  mti: MTI;
  primaryAccountNumber?: string; // DE2
  processingCode: string; // DE3
  amount: number; // DE4
  transmissionDateTime: string; // DE7
  systemTraceNumber: string; // DE11
  localTransactionTime: string; // DE12
  localTransactionDate: string; // DE13
  merchantType: string; // DE18
  responseCode?: string; // DE39
  terminalId: string; // DE41
  merchantId: string; // DE42
  additionalData?: Record<string, string>;
}

export interface TransactionResponse {
  success: boolean;
  message: string;
  data: ISO8583Message;
  responseCode: string;
  authorizationCode?: string;
}

export type TransactionType = 'PURCHASE' | 'REFUND' | 'REVERSAL';
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR';
export type SimulationStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id?: string;
  type: TransactionType;
  amount: number;
  card_number: string;
  merchant_id: string;
  status: TransactionStatus;
  timestamp: string;
  iso8583_message: ISO8583Message;
  simulation_batch_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SimulationBatch {
  id?: string;
  start_time: string;
  end_time?: string;
  target_tps: number;
  actual_tps?: number;
  total_amount?: number;
  success_rate?: number;
  status: SimulationStatus;
  created_at?: string;
  updated_at?: string;
}