export const processTransaction = async (data: any) => {
  const response = await fetch("http://127.0.0.1:8000/process-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const processBatch = async (data: any) => {
  const response = await fetch("http://127.0.0.1:8000/process-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const getTransactions = async () => {
  const response = await fetch("http://127.0.0.1:8000/transactions");
  return response.json();
};