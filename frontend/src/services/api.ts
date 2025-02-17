const API_BASE_URL = "https://transactionsimulator.onrender.com";

export const processTransaction = async (data: any) => {
  const response = await fetch(`${API_BASE_URL}/api/process-transaction`, {
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
  try {
    const response = await fetch(`${API_BASE_URL}/api/process-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Validation errors:", errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error processing batch:", error);
    throw error;
  }
};

export const getTransactions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};