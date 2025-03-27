const fetch = require("node-fetch");

exports.handler = async (event) => {
  const targetUrl = "https://l5668hu646.execute-api.us-east-1.amazonaws.com/prod/api/public/transactions";
  const response = await fetch(targetUrl, {
    method: event.httpMethod,
    headers: { "Content-Type": "application/json" },
    body: event.httpMethod === "POST" ? event.body : undefined
  });
  const data = await response.text();
  return {
    statusCode: response.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: data
  };
};