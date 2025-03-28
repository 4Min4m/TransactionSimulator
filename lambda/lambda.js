const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Allow All
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const { path, httpMethod, body } = event;

  console.log("Received event:", event);

  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (path === "/api/public/process-transaction" && httpMethod === "POST") {
    const data = JSON.parse(body);
    const response = {
      success: Math.random() > 0.2,
      message: "Transaction processed",
      data: { ...data, responseCode: "00" },
    };
    await supabase.from("transactions").insert([data]);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  }

  if (path === "/api/public/transactions" && httpMethod === "GET") {
    const { data } = await supabase.from("transactions").select("*").limit(10);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ detail: "Not found" }),
  };
};