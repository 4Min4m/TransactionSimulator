import React, { useState } from "react";
import { CreditCard, DollarSign, Building2, Send } from "lucide-react";
import { processTransaction } from "../services/api";

export default function TransactionForm() {
  const [card_number, setCardNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant_id, setMerchantId] = useState("MERCH001");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanedCardNumber = card_number.replace(/\s/g, '');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Amount must be a valid number greater than 0.");
      return;
    }
    setLoading(true);

    try {
      const payload = {
        card_number: cleanedCardNumber,
        amount: parsedAmount,
        merchant_id: merchant_id,
      };
  
      const response = await processTransaction(payload);
      setResult(response);
    } catch (error) {
      console.error("Error processing transaction:", error);
      setResult({ success: false, message: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          value={card_number}
          maxLength={19}
          onChange={(e) => {
            let value = e.target.value.replace(/[^0-9]/g, '');
            value = value.slice(0, 16);
            value = value.replace(/(.{4})/g, '$1 ').trim();
            setCardNumber(value);
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
          value={merchant_id}
          onChange={(e) => setMerchantId(e.target.value)}
        >
          <option value="MERCH001">Example Store</option>
          <option value="MERCH002">Test Restaurant</option>
          <option value="MERCH003">Demo Shop</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Send className="w-4 h-4" />
        {loading ? "Processing..." : "Process Transaction"}
      </button>

      {result && (
        <div className="mt-4 p-4 rounded-md bg-gray-50">
          <p className={`text-sm ${result.success ? "text-green-800" : "text-red-800"}`}>
            {result.message}
          </p>
        </div>
      )}
    </form>
  );
}