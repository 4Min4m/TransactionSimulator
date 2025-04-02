const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
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

  if (path === "/api/login" && httpMethod === "POST") {
    try {
      const { username, password } = JSON.parse(body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Login successful", username }),
      };
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "Invalid login credentials" }),
      };
    }
  }

  if (path === "/api/transactions" && httpMethod === "POST") {
    try {
      const data = JSON.parse(body);
      const response = {
        success: Math.random() > 0.2,
        message: "Transaction processed",
        data: { ...data, responseCode: "00" },
      };
      const { error } = await supabase.from("transactions").insert([data]);
      if (error) throw error;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
      };
    } catch (error) {
      console.error("Error in process-transaction:", error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "Invalid request body or database error" }),
      };
    }
  }

  if (path === "/api/transactions" && httpMethod === "GET") {
    try {
      const { data, error } = await supabase.from("transactions").select("*").limit(10);
      if (error) throw error;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ detail: "Error fetching transactions" }),
      };
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ detail: "Not found" }),
  };
};