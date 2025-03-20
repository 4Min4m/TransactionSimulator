const { processBatch } = require('../../src/services/batchService');
const { processTransaction } = require('../../src/services/transactionService');

// Mock the transaction service
jest.mock('../../src/services/transactionService', () => ({
  processTransaction: jest.fn().mockResolvedValue({
    success: true,
    message: 'Transaction approved',
    data: { card_number: '4111111111111111', amount: 100, merchant_id: 'MERCH001' },
    response_code: '00',
    authorization_code: 'ABC123'
  })
}));

describe('Batch Service', () => {
  const mockBatch = {
    total_transactions: 3,
    total_amount: 300.0,
    duration_seconds: 1,
    merchant_id: 'MERCH001'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(global.Date, 'now').mockImplementation(() => 1000);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('should process a batch of transactions', async () => {
    // Mock setTimeout to resolve immediately
    jest.spyOn(global, 'setTimeout').mockImplementation(fn => fn());
    
    const response = await processBatch(mockBatch);
    
    expect(processTransaction).toHaveBeenCalledTimes(mockBatch.total_transactions);
    expect(response).toHaveProperty('success_count', 3);
    expect(response).toHaveProperty('failure_count', 0);
    expect(response).toHaveProperty('average_response_time');
    expect(response).toHaveProperty('total_processed_amount', mockBatch.total_amount);
    expect(response.transactions).toHaveLength(mockBatch.total_transactions);
  });
});