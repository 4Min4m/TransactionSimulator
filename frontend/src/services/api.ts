import { TransactionResponse } from "../types/iso8583";

const API_BASE_URL = "https://glorious-space-goldfish-9qw9xv459qj3qqv-8000.app.github.dev";

export const processTransaction = async (data: any): Promise<TransactionResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/public/process-transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Validation errors:", errorData);
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const processBatch = async (data: any): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/process-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Validation errors:", errorData);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error processing batch:", error);
    throw error;
  }
};

export const getTransactions = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/transactions`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};