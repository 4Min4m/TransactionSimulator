const request = require('supertest');
const app = require('../../src/app');
const { processBatch } = require('../../src/services/batchService');

// Mock the batch service
jest.mock('../../src/services/batchService', () => ({
  processBatch: jest.fn()
}));

describe('Batch Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/batch/process', () => {
    const validBatch = {
      total_transactions: 10,
      total_amount: 1000.0,
      duration_seconds: 10,
      merchant_id: 'MERCH001'
    };

    test('should process a valid batch', async () => {
      processBatch.mockResolvedValue({
        success_count: 9,
        failure_count: 1,
        average_response_time: 0.5,
        total_processed_amount: 900.0,
        transactions: []
      });

      const response = await request(app)
        .post('/api/batch/process')
        .send(validBatch)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(processBatch).toHaveBeenCalledWith(validBatch);
      expect(response.body).toHaveProperty('success_count', 9);
      expect(response.body).toHaveProperty('failure_count', 1);
    });

    test('should return 400 for invalid batch data', async () => {
      const invalidBatch = {
        total_transactions: -5, // Negative transactions
        total_amount: 1000.0,
        duration_seconds: 10,
        merchant_id: 'MERCH001'
      };

      const response = await request(app)
        .post('/api/batch/process')
        .send(invalidBatch)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(processBatch).not.toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', false);
    });
  });
});