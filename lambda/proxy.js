const fetch = require("node-fetch");

exports.handler = async (event) => {
  console.log("Event received:", event);
  try {
    const targetUrl = process.env.TARGET_API_URL || "https://goz81amuq7.execute-api.us-east-1.amazonaws.com/prod/api/public/transactions";
    console.log("Target URL:", targetUrl);

    let adjustedUrl = targetUrl;
    if (event.path === "/login") {
      adjustedUrl = targetUrl.replace("/public/transactions", "/login");
    } else if (event.path === "/public/process-transaction") {
      adjustedUrl = targetUrl.replace("/public/transactions", "/public/process-transaction");
    } else if (event.path === "/public/process-batch") {
      adjustedUrl = targetUrl.replace("/public/transactions", "/public/process-batch");
    } else if (event.path === "/public/transactions") {
      adjustedUrl = targetUrl; // مسیر درست برای تراکنش‌ها
    }

    console.log("Adjusted URL:", adjustedUrl);

    const response = await fetch(adjustedUrl, {
      method: event.httpMethod,
      headers: { "Content-Type": "application/json" },
      body: event.httpMethod === "POST" ? event.body : undefined,
    });

    console.log("Response status:", response.status);
    const data = await response.text();
    console.log("Response data:", data);

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: data,
    };
  } catch (error) {
    console.error("Error in proxy:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};