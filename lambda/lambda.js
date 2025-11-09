const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be provided in environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ISO 8583
const generateISO8583Message = (transaction, responseCode) => {
  const now = new Date();
  return {
    mti: "0110",
    primaryAccountNumber: transaction.card_number,
    processingCode: "000000",
    amount: transaction.amount,
    transmissionDateTime: now.toISOString().replace(/[-:T.]/g, "").slice(0, 14),
    systemTraceNumber: Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString(),
    localTransactionTime: now.toTimeString().slice(0, 8),
    localTransactionDate: now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    merchantType: "5999",
    responseCode: responseCode,
    terminalId: "TERM001",
    merchantId: transaction.merchant_id,
  };
};

const processSingleTransaction = async (transaction) => {
  const isApproved = Math.random() < 0.9; // 90%
  const responseCode = isApproved ? "00" : "05";

  const iso8583Message = generateISO8583Message(transaction, responseCode);

  const transactionData = {
    ...transaction,
    type: "PURCHASE",
    status: isApproved ? "APPROVED" : "DECLINED",
    iso8583_message: iso8583Message,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("transactions")
    .insert([transactionData]);

  if (error) throw error;

  return {
    success: isApproved,
    message: isApproved ? "Transaction approved" : "Transaction declined",
    data: {
      ...transactionData,
      responseCode: responseCode,
      processed_at: new Date().toISOString()
    }
  };
};

const processBatch = async (batch) => {
  console.log("Starting processBatch with:", JSON.stringify(batch));
  const totalTransactions = batch.total_transactions;
  const amountPerTransaction = batch.total_amount / totalTransactions;
  const delayBetweenTransactions = batch.duration_seconds / totalTransactions;

  let successCount = 0;
  let failureCount = 0;
  let totalResponseTime = 0;
  let totalProcessedAmount = 0;
  const transactions = [];

  for (let i = 0; i < totalTransactions; i++) {
    console.log(`Processing transaction ${i + 1}/${totalTransactions}`);
    const startTime = Date.now();

    const transaction = {
      card_number: "4111111111111111",
      amount: amountPerTransaction,
      merchant_id: batch.merchant_id,
    };

    try {
      const response = await processSingleTransaction(transaction);
      console.log(`Transaction ${i + 1} response:`, JSON.stringify(response));
      if (response.success) {
        successCount++;
        totalProcessedAmount += amountPerTransaction;
      } else {
        failureCount++;
      }
      transactions.push(response);
    } catch (error) {
      console.error(`Error in transaction ${i + 1}:`, error);
      failureCount++;
      transactions.push({ success: false, message: "Transaction failed", error: error.message });
    }

    totalResponseTime += Date.now() - startTime;
    console.log(`Delaying for ${delayBetweenTransactions} seconds`);
    await new Promise((resolve) => setTimeout(resolve, delayBetweenTransactions * 1000));
  }

  const result = {
    success_count: successCount,
    failure_count: failureCount,
    average_response_time: totalResponseTime / totalTransactions,
    total_processed_amount: totalProcessedAmount,
    transactions,
  };
  console.log("processBatch result:", JSON.stringify(result));
  return result;
};

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With"
  };

  console.log("Full event:", JSON.stringify(event, null, 2));

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }

  const path = event.path || '';
  const httpMethod = event.httpMethod;
  
  console.log(`Processing ${httpMethod} request to ${path}`);

  if (path === "/api/login" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const { username, password } = requestBody;
      
      console.log(`Login attempt for user: ${username}`);
      
      if (!username || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ detail: "Username and password are required" })
        };
      }
      
      if (username === "admin" && password === "password123") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            message: "Login successful", 
            username, 
            token: "sample-token-would-be-jwt-in-production" 
          })
        };
      } else {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ detail: "Invalid credentials" })
        };
      }
    } catch (error) {
      console.error("Login error:", error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          detail: "Invalid login request", 
          error: error.message 
        })
      };
    }
  }

if (path === "/api/transactions" && httpMethod === "POST") {
  try {
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const { merchant_id, amount, card_number, order_id } = requestBody;

    console.log('Received transaction request:', JSON.stringify(requestBody, null, 2));

    // validating input
    if (!merchant_id || !amount || !card_number || !order_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          detail: "merchant_id, amount, card_number, and order_id are required" 
        })
      };
    }
    if (merchant_id !== "thread-thought") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "Invalid merchant_id" })
      };
    }
    if (typeof amount !== "number" || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "amount must be a positive number" })
      };
    }

    const isApproved = Math.random() < 0.9; // 90% احتمال موفقیت
    const responseCode = isApproved ? "00" : "05";

    const iso8583Message = generateISO8583Message(requestBody, responseCode);

    const transactionData = {
      ...requestBody,
      type: "PURCHASE",
      status: isApproved ? "APPROVED" : "DECLINED",
      iso8583_message: iso8583Message,
      created_at: new Date().toISOString(),
      order_id: requestBody.order_id
    };

    const { error } = await supabase
      .from("transactions")
      .insert([transactionData]);

    if (error) {
      console.error('Supabase insert error:', error.message, error.details);
      throw error;
    }

    const response = {
      success: isApproved,
      message: isApproved ? "Transaction approved" : "Transaction declined",
      data: { 
        ...transactionData, 
        responseCode: responseCode,
        processed_at: new Date().toISOString()
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Error processing transaction:", error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        detail: "Error processing transaction", 
        error: error.message 
      })
    };
  }
}

  if (path === "/api/process-batch" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      
      console.log("Batch request:", JSON.stringify(requestBody));
      
      const response = await processBatch(requestBody);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
      };
    } catch (error) {
      console.error("Error processing batch:", error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          detail: "Error processing batch", 
          error: error.message 
        })
      };
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ 
      detail: "Not found",
      path: path,
      method: httpMethod
    })
  };
};
