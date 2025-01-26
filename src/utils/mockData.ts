import { MTI, ISO8583Message } from '../types/iso8583';

// Mock card numbers (use obviously fake numbers for testing)
export const MOCK_CARDS = [
  '4111111111111111',
  '5555555555554444',
  '3782822463100005'
];

// Mock merchant IDs
export const MOCK_MERCHANTS = [
  { id: 'MERCH001', name: 'Example Store', type: '5411' },
  { id: 'MERCH002', name: 'Test Restaurant', type: '5812' },
  { id: 'MERCH003', name: 'Demo Shop', type: '5999' }
];

// Response codes
export const RESPONSE_CODES = {
  APPROVED: '00',
  DECLINED: '05',
  INVALID_TRANSACTION: '12',
  INVALID_AMOUNT: '13',
  INVALID_CARD: '14',
  SYSTEM_ERROR: '96'
};

// Generate system trace number
export const generateTraceNumber = () => 
  Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

// Generate ISO 8583 formatted date time
export const generateTransmissionDateTime = () => {
  const now = new Date();
  return now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
};