const request = require('supertest');
const app = require('../../src/app');
const { processTransaction } = require('../../src/services/transactionService');
const supabase = require('../../src/config/supabaseClient');

// Mock the transaction service
jest.mock('../../src/services/transactionService', () => ({
  processTransaction: jest.fn()
}));

// Mock Supabase client
jest.mock('../../src/config/supabaseClient', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  execute: jest.fn()
}));

describe('Transaction Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/transactions/process', () => {
    const validTransaction = {
      card_number: '4111111111111111',
      amount: 100.0,
      merchant_id: 'MERCH001'
    };

    test('should process a valid transaction', async () => {
      processTransaction.mockResolvedValue({
        success: true,
        message: 'Transaction approved',
        data: validTransaction,
        response_code: '00',
        authorization_code: 'ABC123'
      });

      const response = await request(app)
        .post('/api/transactions/process')
        .send(validTransaction)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(processTransaction).toHaveBeenCalledWith(validTransaction);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Transaction approved');
    });

    test('should return 400 for invalid transaction data', async () => {
      const invalidTransaction = {
        card_number: '12345', // Invalid length
        amount: -100, // Negative amount
        merchant_id: 'MERCH001'
      };

      const response = await request(app)
        .post('/api/transactions/process')
        .send(invalidTransaction)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(processTransaction).not.toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/transactions', () => {
    test('should return all transactions', async () => {
      const mockData = [
        {
          id: 1,
          card_number: '4111111111111111',
          amount: 100.0,
          merchant_id: 'MERCH001',
          status: 'APPROVED'
        }
      ];
      
      supabase.from().select().execute.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app)
        .get('/api/transactions')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(supabase.from().select).toHaveBeenCalledWith('*');
      expect(response.body).toEqual(mockData);
    });
  });
});