import React, { useState } from 'react';
import { CreditCard, Building2, DollarSign, Send, Timer, Hash, Wallet } from 'lucide-react';
import { ISO8583Message, MTI } from '../types/iso8583';
import { TransactionService } from '../services/transactionService';
import { MOCK_MERCHANTS } from '../utils/mockData';

interface BatchResult {
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  totalProcessedAmount: number;
  transactions: any[];
}

export default function TransactionForm() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    cardNumber: '',
    amount: '',
    merchantId: MOCK_MERCHANTS[0].id
  });
  const [batchData, setBatchData] = useState({
    totalTransactions: 100,
    totalAmount: 10000,
    durationSeconds: 60,
    merchantId: MOCK_MERCHANTS[0].id
  });

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
  
    const transaction: ISO8583Message = {
      mti: MTI.AUTHORIZATION_REQUEST,
      primaryAccountNumber: formData.cardNumber.replace(/\s/g, ''),
      processingCode: '000000',
      amount: parseFloat(formData.amount) * 100, // Convert to cents
      transmissionDateTime: new Date().toISOString(),
      systemTraceNumber: Math.floor(Math.random() * 1000000).toString(),
      localTransactionTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
      localTransactionDate: new Date().toLocaleDateString('en-US'),
      merchantType: MOCK_MERCHANTS.find(m => m.id === formData.merchantId)?.type || '5999',
      terminalId: 'TERM001',
      merchantId: formData.merchantId
    };
  
    try {
      const response = await TransactionService.processTransaction(transaction);  
      setResult(response);
    } catch (error) {
      console.error('Transaction processing error:', error);
      setResult({
        success: false,
        message: 'An error occurred while processing the transaction',
        data: transaction,
        responseCode: 'ERROR'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const batchResults = await TransactionService.processBatchTransactions({
        totalTransactions: batchData.totalTransactions,
        totalAmount: batchData.totalAmount,
        durationSeconds: batchData.durationSeconds,
        merchantId: batchData.merchantId
      });
      setResult(batchResults);
    } catch (error) {
      console.error('Batch processing error:', error);
      setResult({
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        totalProcessedAmount: 0,
        transactions: []
      });
    }
    setLoading(false);
  };

  const renderBatchResults = (result: BatchResult) => {
    if (!result) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm font-medium text-gray-500">Successful Transactions</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{result.successCount || 0}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm font-medium text-gray-500">Failed Transactions</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{result.failureCount || 0}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm font-medium text-gray-500">Average Response Time</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">
              {(result.averageResponseTime || 0).toFixed(2)}ms
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm font-medium text-gray-500">Total Amount Processed</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">
              ${(result.totalProcessedAmount || 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Transaction Details</h4>
          <pre className="overflow-auto text-sm">
            {JSON.stringify(result.transactions?.slice(0, 5) || [], null, 2)}
            {result.transactions?.length > 5 && '\n... and ' + (result.transactions.length - 5) + ' more transactions'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('single')}
            className={`${
              activeTab === 'single'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Single Transaction
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`${
              activeTab === 'batch'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Batch Testing
          </button>
        </nav>
      </div>

      {activeTab === 'single' ? (
        <form onSubmit={handleSingleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Card Number</span>
              </div>
            </label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="4111 1111 1111 1111"
              maxLength={19}
              value={formData.cardNumber}
              onChange={(e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                value = value.slice(0, 16);
                value = value.replace(/(.{4})/g, '$1 ').trim();
                setFormData({ ...formData, cardNumber: value });
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Amount</span>
              </div>
            </label>
            <input
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="100.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Merchant</span>
              </div>
            </label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={formData.merchantId}
              onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
            >
              {MOCK_MERCHANTS.map(merchant => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Processing...' : 'Process Transaction'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBatchSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                <span>Total Transactions</span>
              </div>
            </label>
            <input
              type="number"
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={batchData.totalTransactions}
              onChange={(e) => setBatchData({ ...batchData, totalTransactions: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                <span>Total Amount ($)</span>
              </div>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={batchData.totalAmount}
              onChange={(e) => setBatchData({ ...batchData, totalAmount: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4" />
                <span>Duration (seconds)</span>
              </div>
            </label>
            <input
              type="number"
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={batchData.durationSeconds}
              onChange={(e) => setBatchData({ ...batchData, durationSeconds: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Merchant</span>
              </div>
            </label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={batchData.merchantId}
              onChange={(e) => setBatchData({ ...batchData, merchantId: e.target.value })}
            >
              {MOCK_MERCHANTS.map(merchant => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Processing Batch...' : 'Run Batch Test'}
          </button>
        </form>
      )}

      {result && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {activeTab === 'single' ? 'Transaction Result' : 'Batch Test Results'}
          </h3>
          {activeTab === 'single' ? (
            <>
              <div className={`p-4 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </p>
                {result.authorizationCode && (
                  <p className="text-sm text-gray-600 mt-2">
                    Authorization Code: {result.authorizationCode}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Response Details</h4>
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            renderBatchResults(result)
          )}
        </div>
      )}
    </div>
  );
}