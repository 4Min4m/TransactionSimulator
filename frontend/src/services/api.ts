const API_BASE_URL = "/api";

export const processTransaction = async (data: any) => {
  const response = await fetch(`${API_BASE_URL}/process-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Validation errors:", errorData);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const processBatch = async (data: any) => {
  const response = await fetch(`${API_BASE_URL}/process-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const getTransactions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};