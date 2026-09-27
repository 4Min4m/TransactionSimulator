import { TransactionResponse } from "../types/iso8583";
import { getToken, clearToken } from "./auth";

// Base URL of the API Gateway stage, e.g. https://xxxx.execute-api.us-east-1.amazonaws.com/prod
// Injected at build time via Vite (see .env / CI `VITE_API_BASE_URL`). No hardcoded URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is not set. Define it in frontend/.env (local) or as a CI variable (deploy)."
  );
}

// Strip any trailing slash so `${API_BASE_URL}/api/...` never doubles up.
const BASE = API_BASE_URL.replace(/\/+$/, "");

interface LoginCredentials {
  username: string;
  password: string;
}

export interface BatchStatus {
  id: string;
  status: "queued" | "processing" | "completed";
  total_transactions: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at?: string;
}

// Build headers, attaching the Bearer token for protected calls.
const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

// Read a safe error message from a failed response body.
const extractError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    // Lambda returns { error, traceId }; keep `detail` as a fallback.
    return data.error || data.detail || `HTTP error! status: ${response.status}`;
  } catch {
    return `HTTP error! status: ${response.status}`;
  }
};

// Shared handling for protected responses: on 401/403 clear the stale token.
const handleProtected = async (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    clearToken();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(await extractError(response));
  }
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

export const processTransaction = async (data: any): Promise<TransactionResponse> => {
  const response = await fetch(`${BASE}/api/transactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleProtected(response);
};

// Kicks off a batch load test. The backend now processes batches
// asynchronously (see docs/FIXES_AND_CHANGES_fa.md) — this returns a
// batch_id immediately instead of blocking until every simulated
// transaction finishes. Poll `getBatchStatus` for progress/result.
export const startBatch = async (data: any): Promise<{ batch_id: string; status: string }> => {
  const response = await fetch(`${BASE}/api/process-batch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleProtected(response);
};

export const getBatchStatus = async (batchId: string): Promise<BatchStatus> => {
  const response = await fetch(`${BASE}/api/batches/${encodeURIComponent(batchId)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  return handleProtected(response);
};

// Kept as `processBatch` for backwards compatibility with existing callers
// that only care about "did the batch get accepted", but callers that want
// progress should switch to startBatch + getBatchStatus.
export const processBatch = startBatch;

export const getTransactions = async (limit = 50, offset = 0): Promise<any[]> => {
  const response = await fetch(
    `${BASE}/api/transactions?limit=${limit}&offset=${offset}`,
    { method: "GET", headers: authHeaders() }
  );
  const data = await handleProtected(response);
  // Backend now returns { items, limit, offset } instead of a bare array
  // (see docs/FIXES_AND_CHANGES_fa.md) — unwrap here so existing callers
  // that expect an array of transactions don't need to change.
  return data.items || [];
};
