import { Transaction, TransactionResponse } from "../types/iso8583";
import { getToken, clearToken } from "./auth";

// API Gateway stage URL, e.g. https://xxxx.execute-api.us-east-1.amazonaws.com/prod
// Injected at build time (frontend/.env.local or the CI variable VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is not set. Define it in frontend/.env.local (local) or as a CI variable (deploy)."
  );
}

const BASE = API_BASE_URL.replace(/\/+$/, "");

interface LoginCredentials {
  username: string;
  password: string;
}

export interface PaymentRequest {
  merchant_id: string;
  order_id: string;
  amount: number;
  card_number: string;
  currency?: "USD" | "EUR" | "GBP";
}

export interface BatchRequest {
  total_transactions: number;
  total_amount: number;
  duration_seconds: number;
  merchant_id: string;
}

export interface BatchStatus {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  total_transactions: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at?: string;
}

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

// The API returns { error, traceId? } on failure.
const extractError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    return data.error || `Request failed (HTTP ${response.status})`;
  } catch {
    return `Request failed (HTTP ${response.status})`;
  }
};

// Protected calls: a 401/403 means the token is missing or expired.
const handleProtected = async <T>(response: Response): Promise<T> => {
  if (response.status === 401 || response.status === 403) {
    clearToken();
    throw new Error("Please sign in to use the simulator.");
  }
  if (!response.ok) throw new Error(await extractError(response));
  return response.json();
};

export const login = async (credentials: LoginCredentials) => {
  const response = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return response.json();
};

export const processTransaction = async (data: PaymentRequest): Promise<TransactionResponse> =>
  handleProtected(
    await fetch(`${BASE}/api/transactions`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) })
  );

// Batches are processed asynchronously: this returns a batch_id at once;
// poll getBatchStatus for progress.
export const startBatch = async (data: BatchRequest): Promise<{ batch_id: string; status: string }> =>
  handleProtected(
    await fetch(`${BASE}/api/process-batch`, { method: "POST", headers: authHeaders(), body: JSON.stringify(data) })
  );

export const getBatchStatus = async (batchId: string): Promise<BatchStatus> =>
  handleProtected(
    await fetch(`${BASE}/api/batches/${encodeURIComponent(batchId)}`, { method: "GET", headers: authHeaders() })
  );

export const getTransactions = async (limit = 50, offset = 0): Promise<Transaction[]> => {
  const data = await handleProtected<{ items: Transaction[] }>(
    await fetch(`${BASE}/api/transactions?limit=${limit}&offset=${offset}`, { method: "GET", headers: authHeaders() })
  );
  return data.items || [];
};
