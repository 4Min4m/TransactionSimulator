const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be provided in environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
};

// تابع کمکی برای ساخت پاسخ
const createResponse = (statusCode, body, headers = defaultHeaders) => {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
};

// تابع اعتبارسنجی توکن با Supabase
const authenticateToken = async (event) => {
  const authHeader = event.headers["authorization"] || event.headers["Authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return createResponse(401, { detail: "No token provided" });
  }

  try {
    const { data: user, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error("Invalid token");
    return { user: user.user };
  } catch (error) {
    return createResponse(403, { detail: "Invalid or expired token" });
  }
};


// تابع برای ساخت پیام ISO 8583
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

// تابع برای پردازش یه تراکنش
const processSingleTransaction = async (transaction) => {
  const isApproved = Math.random() < 0.9;
  const responseCode = isApproved ? "00" : "05";

  const iso8583Message = generateISO8583Message(transaction, responseCode);

  const transactionData = {
    ...transaction,
    type: "PURCHASE",
    status: isApproved ? "APPROVED" : "DECLINED",
    iso8583_message: iso8583Message,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("transactions").insert([transactionData]);
  if (error) throw error;

  return {
    success: isApproved,
    message: isApproved ? "Transaction approved" : "Transaction declined",
    data: { ...transactionData, responseCode, processed_at: new Date().toISOString() },
  };
};

// تابع برای پردازش دسته‌ای تراکنش‌ها
const processBatch = async (batch) => {
  const totalTransactions = batch.total_transactions;
  const amountPerTransaction = batch.total_amount / totalTransactions;
  const delayBetweenTransactions = batch.duration_seconds / totalTransactions;

  let successCount = 0;
  let failureCount = 0;
  let totalResponseTime = 0;
  let totalProcessedAmount = 0;
  const transactions = [];

  for (let i = 0; i < totalTransactions; i++) {
    const startTime = Date.now();
    const transaction = {
      card_number: "4111111111111111",
      amount: amountPerTransaction,
      merchant_id: batch.merchant_id,
    };

    try {
      const response = await processSingleTransaction(transaction);
      if (response.success) {
        successCount++;
        totalProcessedAmount += amountPerTransaction;
      } else {
        failureCount++;
      }
      transactions.push(response);
    } catch (error) {
      failureCount++;
      transactions.push({ success: false, message: "Transaction failed", error: error.message });
    }

    totalResponseTime += Date.now() - startTime;
    await new Promise((resolve) => setTimeout(resolve, delayBetweenTransactions * 1000));
  }

  return {
    success_count: successCount,
    failure_count: failureCount,
    average_response_time: totalResponseTime / totalTransactions,
    total_processed_amount: totalProcessedAmount,
    transactions,
  };
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return createResponse(200, {});
  }

  const path = event.path || "";
  const httpMethod = event.httpMethod;

  // مسیر جدید برای ثبت‌نام
  if (path === "/api/signup" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const { email, password } = requestBody;

      if (!email || !password) {
        return createResponse(400, { detail: "Email and password are required" });
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      return createResponse(200, {
        message: "Signup successful. Please check your email to confirm.",
        user: data.user,
      });
    } catch (error) {
      return createResponse(400, { detail: error.message || "Signup failed" });
    }
  }

  if (path === "/api/login" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const { email, password } = requestBody;

      if (!email || !password) {
        return createResponse(400, { detail: "Email and password are required" });
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const token = data.session.access_token;
      return createResponse(200, { message: "Login successful", token, user: data.user });
    } catch (error) {
      return createResponse(401, { detail: error.message || "Invalid credentials" });
    }
  }

  if (path === "/api/transactions") {
    if (httpMethod === "GET") {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        return createResponse(200, data);
      } catch (error) {
        return createResponse(500, { detail: "Error fetching transactions", error: error.message });
      }
    }

    if (httpMethod === "POST") {
      try {
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const response = await processSingleTransaction(requestBody);
        return createResponse(200, response);
      } catch (error) {
        return createResponse(400, { detail: "Error processing transaction", error: error.message });
      }
    }
  }

  if (path === "/api/process-batch" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const response = await processBatch(requestBody);
      return createResponse(200, response);
    } catch (error) {
      return createResponse(400, { detail: "Error processing batch", error: error.message });
    }
  }

  if (path === "/api/admin" && httpMethod === "GET") {
    const authResult = await authenticateToken(event);
    if (authResult.statusCode) return authResult;

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const totalTransactions = data.length;
      const totalAmount = data.reduce((sum, tx) => sum + tx.amount, 0);
      const successfulTransactions = data.filter((tx) => tx.status === "APPROVED").length;
      const failedTransactions = data.filter((tx) => tx.status === "DECLINED").length;
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      return createResponse(200, {
        totalTransactions,
        totalAmount,
        successfulTransactions,
        failedTransactions,
        successRate,
        transactions: data.slice(0, 5),
      });
    } catch (error) {
      return createResponse(500, { detail: "Error fetching admin data", error: error.message });
    }
  }

  return createResponse(404, { detail: "Not found", path, method: httpMethod });
};