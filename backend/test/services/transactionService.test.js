const { processTransaction, generateIso8583Message } = require('../../src/services/transactionService');

// Mock Supabase client
jest.mock('../../src/config/supabaseClient', () => ({
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: [], error: null })
}));

describe('Transaction Service', () => {
  const mockTransaction = {
    card_number: '4111111111111111',
    amount: 100.0,
    merchant_id: 'MERCH001'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock random to make tests deterministic
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should generate ISO8583 message correctly', () => {
    const responseCode = '00';
    const message = generateIso8583Message(mockTransaction, responseCode);
    
    expect(message).toHaveProperty('mti', '0110');
    expect(message).toHaveProperty('primaryAccountNumber', mockTransaction.card_number);
    expect(message).toHaveProperty('amount', mockTransaction.amount);
    expect(message).toHaveProperty('responseCode', responseCode);
    expect(message).toHaveProperty('merchantId', mockTransaction.merchant_id);
  });

  test('should process a transaction successfully', async () => {
    const response = await processTransaction(mockTransaction);
    
    expect(response).toHaveProperty('success', true);
    expect(response).toHaveProperty('message', 'Transaction approved');
    expect(response).toHaveProperty('data', mockTransaction);
    expect(response).toHaveProperty('response_code', '00');
    expect(response).toHaveProperty('authorization_code');
  });
});