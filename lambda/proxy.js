const fetch = require("node-fetch");

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event, null, 2));

  // پاسخ به درخواست‌های OPTIONS (Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
      body: JSON.stringify({ message: 'CORS preflight passed' }),
    };
  }

  try {
    // تنظیم URL هدف بر اساس مسیر
    const baseUrl = process.env.TARGET_API_URL || "https://goz81amuq7.execute-api.us-east-1.amazonaws.com/prod/api/public/transactions";
    let adjustedUrl = baseUrl;

    const pathMappings = {
      '/login': '/login',
      '/public/process-transaction': '/public/process-transaction',
      '/public/process-batch': '/public/process-batch',
      '/public/transactions': '/public/transactions',
    };

    if (pathMappings[event.path]) {
      adjustedUrl = baseUrl.replace('/public/transactions', pathMappings[event.path]);
    }

    console.log("Forwarding to:", adjustedUrl);

    // ارسال درخواست به بک‌اند اصلی
    const response = await fetch(adjustedUrl, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        ...(event.headers.Authorization && { Authorization: event.headers.Authorization }),
      },
      body: ['POST', 'PUT', 'DELETE'].includes(event.httpMethod) ? event.body : undefined,
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: data,
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};