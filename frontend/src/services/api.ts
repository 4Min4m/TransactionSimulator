import { getToken, clearToken, AUTH_EXPIRED_EVENT } from "./auth";

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

// Carries the HTTP status so the UI can show *where* a request stopped
// (401/403 → authorizer, 429 → throttling, 5xx → Lambda). status 0 = network.
export class ApiError extends Error {
  status: number;
  traceId?: string;
  constructor(message: string, status: number, traceId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.traceId = traceId;
  }
}

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

// Shape of a row in the `transactions` table (card_number is always masked).
export interface TxRecord {
  id?: string;
  card_number: string;
  amount: number;
  merchant_id: string;
  status: string;
  order_id?: string;
  created_at?: string;
  timestamp?: string;
  responseCode?: string;
  iso8583_message?: { systemTraceNumber?: string; responseCode?: string };
}

export interface TransactionResult {
  success: boolean;
  message: string;
  data: TxRecord;
}

// Build headers, attaching the Bearer token for protected calls.
const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

// fetch() only rejects on network/CORS failure; normalise that to status 0.
const request = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError("Network error: the API could not be reached.", 0);
  }
};

// Read a safe error message from a failed response body.
const extractError = async (response: Response): Promise<{ message: string; traceId?: string }> => {
  try {
    const data = await response.json();
    // Lambda returns { error, traceId }; keep `detail` as a fallback.
    return {
      message: data.error || data.detail || data.message || `HTTP ${response.status}`,
      traceId: data.traceId,
    };
  } catch {
    return { message: `HTTP ${response.status}` };
  }
};

// Shared handling for protected responses: on 401/403 clear the stale token.
const handleProtected = async (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    const hadToken = !!getToken();
    clearToken();
    if (hadToken) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(
      hadToken ? "Your session has expired. Please sign in again." : "Sign in required.",
      response.status
    );
  }
  if (!response.ok) {
    const { message, traceId } = await extractError(response);
    throw new ApiError(message, response.status, traceId);
  }
  return response.json();
};

export const login = async (credentials: LoginCredentials) => {
  const response = await request(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  try {
    return await response.json();
  } catch {
    return { error: `HTTP ${response.status}` };
  }
};

export const processTransaction = async (data: unknown): Promise<TransactionResult> => {
  const response = await request(`${BASE}/api/transactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleProtected(response);
};

// Kicks off a batch load test. The backend processes batches asynchronously:
// this returns a batch_id immediately (202). Poll `getBatchStatus` for progress.
export const startBatch = async (data: unknown): Promise<{ batch_id: string; status: string }> => {
  const response = await request(`${BASE}/api/process-batch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleProtected(response);
};

export const getBatchStatus = async (batchId: string): Promise<BatchStatus> => {
  const response = await request(`${BASE}/api/batches/${encodeURIComponent(batchId)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  return handleProtected(response);
};

// Kept for backwards compatibility.
export const processBatch = startBatch;

export const getTransactions = async (limit = 50, offset = 0): Promise<TxRecord[]> => {
  const response = await request(`${BASE}/api/transactions?limit=${limit}&offset=${offset}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await handleProtected(response);
  // Backend returns { items, limit, offset }.
  return data.items || [];
};
