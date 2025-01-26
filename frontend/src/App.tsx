import React from 'react';
import { CreditCard } from 'lucide-react';
import TransactionForm from './components/TransactionForm';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CreditCard className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Payment Transaction Simulator
            </h1>
          </div>
          <p className="text-gray-600">
            Test payment transactions using mock data and ISO 8583 message format
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg">
          <TransactionForm />
        </div>
      </div>
    </div>
  );
}

export default App;