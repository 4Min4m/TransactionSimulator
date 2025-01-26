import { ISO8583Message, MTI, TransactionResponse, Transaction, SimulationBatch } from '../types/iso8583';
import { RESPONSE_CODES, generateTraceNumber, generateTransmissionDateTime, MOCK_CARDS } from '../utils/mockData';
import { supabase } from '../supabaseClient';

interface BatchTestParams {
  totalTransactions: number;
  totalAmount: number;
  durationSeconds: number;
  merchantId: string;
}

interface BatchTestResult {
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  totalProcessedAmount: number;
  transactions: TransactionResponse[];
}

const maskCardNumber = (cardNumber: string): string => {
  return cardNumber.slice(-4).padStart(cardNumber.length, '*');
};

export class TransactionService {
  static async processTransaction(transaction: ISO8583Message): Promise<TransactionResponse> {
    const startTime = performance.now();
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    // Simple validation logic
    if (!transaction.primaryAccountNumber || transaction.primaryAccountNumber.length < 15) {
      return {
        success: false,
        message: 'Invalid card number',
        data: transaction,
        responseCode: RESPONSE_CODES.INVALID_CARD
      };
    }

    if (transaction.amount <= 0) {
      return {
        success: false,
        message: 'Invalid amount',
        data: transaction,
        responseCode: RESPONSE_CODES.INVALID_AMOUNT
      };
    }

    // Random approval (90% success rate)
    const isApproved = Math.random() < 0.9;

    const response: ISO8583Message = {
      ...transaction,
      mti: MTI.AUTHORIZATION_RESPONSE,
      responseCode: isApproved ? RESPONSE_CODES.APPROVED : RESPONSE_CODES.DECLINED,
      transmissionDateTime: generateTransmissionDateTime(),
      systemTraceNumber: generateTraceNumber()
    };

    // Store transaction in Supabase
    const dbTransaction: Transaction = {
      type: 'PURCHASE',
      amount: transaction.amount / 100, // Convert cents to dollars
      card_number: maskCardNumber(transaction.primaryAccountNumber || ''),
      merchant_id: transaction.merchantId,
      status: isApproved ? 'APPROVED' : 'DECLINED',
      timestamp: new Date().toISOString(),
      iso8583_message: response
    };

    const { error } = await supabase
      .from('transactions')
      .insert(dbTransaction);

    if (error) {
      console.error('Error storing transaction:', error);
    }

    return {
      success: isApproved,
      message: isApproved ? 'Transaction approved' : 'Transaction declined',
      data: response,
      responseCode: response.responseCode,
      authorizationCode: isApproved ? Math.random().toString(36).slice(2, 8).toUpperCase() : undefined
    };
  }

  static async processBatchTransactions(params: BatchTestParams): Promise<BatchTestResult> {
    const { totalTransactions, totalAmount, durationSeconds, merchantId } = params;
    const transactions: TransactionResponse[] = [];
    const amountPerTransaction = totalAmount / totalTransactions;
    const delayBetweenTransactions = (durationSeconds * 1000) / totalTransactions;
    
    let successCount = 0;
    let failureCount = 0;
    let totalResponseTime = 0;
    let totalProcessedAmount = 0;

    // Create simulation batch record
    const simulationBatch: SimulationBatch = {
      start_time: new Date().toISOString(),
      target_tps: Math.ceil(totalTransactions / durationSeconds),
      status: 'RUNNING'
    };

    const { data: batchData, error: batchError } = await supabase
      .from('simulation_batches')
      .insert(simulationBatch)
      .select()
      .single();

    if (batchError) {
      console.error('Error creating simulation batch:', batchError);
      throw new Error('Failed to create simulation batch');
    }

    const batchId = batchData?.id;

    const startTime = performance.now();

    for (let i = 0; i < totalTransactions; i++) {
      const txStartTime = performance.now();
      
      // Create a transaction with a random card from the mock data
      const transaction: ISO8583Message = {
        mti: MTI.AUTHORIZATION_REQUEST,
        primaryAccountNumber: MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)],
        processingCode: '000000',
        amount: amountPerTransaction * 100, // Convert to cents
        transmissionDateTime: new Date().toISOString(),
        systemTraceNumber: generateTraceNumber(),
        localTransactionTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
        localTransactionDate: new Date().toLocaleDateString('en-US'),
        merchantType: '5999',
        terminalId: 'TERM001',
        merchantId: merchantId
      };

      const response = await this.processTransaction(transaction);
      const txEndTime = performance.now();
      
      if (response.success) {
        successCount++;
        totalProcessedAmount += amountPerTransaction;
      } else {
        failureCount++;
      }

      totalResponseTime += (txEndTime - txStartTime);
      transactions.push(response);

      // Add delay between transactions
      if (i < totalTransactions - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenTransactions));
      }
    }

    const endTime = performance.now();
    const actualTps = totalTransactions / ((endTime - startTime) / 1000);
    const successRate = (successCount / totalTransactions) * 100;

    // Update simulation batch record
    if (batchId) {
      const { error: updateError } = await supabase
        .from('simulation_batches')
        .update({
          end_time: new Date().toISOString(),
          actual_tps: actualTps,
          total_amount: totalProcessedAmount,
          success_rate: successRate,
          status: 'COMPLETED'
        })
        .eq('id', batchId);

      if (updateError) {
        console.error('Error updating simulation batch:', updateError);
      }
    }

    return {
      successCount,
      failureCount,
      averageResponseTime: totalResponseTime / totalTransactions,
      totalProcessedAmount,
      transactions
    };
  }
}