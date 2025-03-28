import { TransactionResponse } from "../types/iso8583";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const processTransaction = async (data: any): Promise<TransactionResponse> => {
  const response = await fetch(`${API_BASE_URL}/public/process-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const processBatch = async (data: any): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/public/process-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getTransactions = async (): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/public/transactions`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};