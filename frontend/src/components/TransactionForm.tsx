import React, { useState } from "react";
import { CreditCard, DollarSign, Building2, Send, RotateCcw } from "lucide-react";
import { processTransaction, PaymentRequest } from "../services/api";
import { TEST_CARDS, TransactionResponse } from "../types/iso8583";
import { errorMessage } from "../services/errors";

// The backend accepts a single demo merchant (ALLOWED_MERCHANT_ID).
const DEMO_MERCHANT_ID = "demo-merchant";

const formatPan = (digits: string) => digits.replace(/(.{4})/g, "$1 ").trim();

export default function TransactionForm({ onProcessed }: { onProcessed?: () => void }) {
  const [cardDigits, setCardDigits] = useState("4111111111111111");
  const [amount, setAmount] = useState("25.00");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PaymentRequest | null>(null);

  const send = async (payload: PaymentRequest) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await processTransaction(payload));
      setLastRequest(payload);
      onProcessed?.();
    } catch (err) {
      setResult(null);
      setError(errorMessage(err, "The transaction could not be processed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a number greater than 0.");
      return;
    }
    send({
      card_number: cardDigits,
      amount: Math.round(parsedAmount * 100) / 100,
      merchant_id: DEMO_MERCHANT_ID,
      order_id: crypto.randomUUID(), // idempotency key for this payment
    });
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
          inputMode="numeric"
          autoComplete="off"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="4111 1111 1111 1111"
          value={formatPan(cardDigits)}
          onChange={(e) => setCardDigits(e.target.value.replace(/\D/g, "").slice(0, 19))}
        />
        <select
          className="mt-2 block w-full rounded-md border-gray-300 text-sm text-gray-700"
          value=""
          onChange={(e) => e.target.value && setCardDigits(e.target.value)}
        >
          <option value="">Use a test card…</option>
          {TEST_CARDS.map((c) => (
            <option key={c.pan} value={c.pan}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Amount (USD, issuer limit 10,000.00)</span>
          </div>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
        <input
          type="text"
          readOnly
          value={DEMO_MERCHANT_ID}
          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 text-gray-600 shadow-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {loading ? "Processing..." : "Process Transaction"}
        </button>
        {lastRequest && (
          <button
            type="button"
            disabled={loading}
            onClick={() => send(lastRequest)}
            title="Send the previous request again with the same order_id"
            className="flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-700 rounded-md hover:bg-indigo-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Retry same order
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <div className={`mt-4 p-4 rounded-md space-y-2 ${result.success ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
            {result.message}: {result.responseCode} — {result.responseMessage}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
            <dt>Card</dt>
            <dd className="font-mono">
              {result.data.card_number} ({result.data.card_scheme})
            </dd>
            <dt>Auth code (field 38)</dt>
            <dd className="font-mono">{result.authorizationCode ?? "—"}</dd>
            <dt>Order id</dt>
            <dd className="font-mono break-all">{result.data.order_id}</dd>
            <dt>Processing time</dt>
            <dd>{result.data.processing_ms ?? "—"} ms</dd>
          </dl>
          {result.idempotentReplay && (
            <p className="text-sm text-indigo-700">
              Idempotent replay: this order_id was already processed, so the original result was returned and no new
              payment was created.
            </p>
          )}
          {result.data.iso8583_message && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-700">ISO 8583 messages (PAN masked)</summary>
              {(["request", "response"] as const).map((k) => (
                <div key={k} className="mt-2">
                  <p className="font-medium text-gray-800">
                    {k === "request" ? "Authorization request" : "Authorization response"} (
                    {result.data.iso8583_message![k].mti})
                  </p>
                  <pre className="overflow-auto bg-white p-2 rounded text-xs">
                    {result.data.iso8583_message![k].raw}
                    {"\n\n"}
                    {JSON.stringify(result.data.iso8583_message![k].fields, null, 2)}
                  </pre>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </form>
  );
}
