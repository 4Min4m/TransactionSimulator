const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  // تعریف هدرها در بالای تابع
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // برای تست، بعداً می‌تونی دامنه S3 رو بذاری
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const { path, httpMethod, body } = event;

  console.log("Received event:", event); // برای دیباگ

  // مدیریت درخواست OPTIONS
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // مدیریت POST برای ثبت تراکنش
  if (path === "/api/public/process-transaction" && httpMethod === "POST") {
    const data = JSON.parse(body);
    const response = {
      success: Math.random() > 0.2,
      message: "Transaction processed",
      data: { ...data, responseCode: "00" }
    };
    await supabase.from("transactions").insert([data]);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
  }

  // مدیریت GET برای گرفتن تراکنش‌ها
  if (path === "/api/public/transactions" && httpMethod === "GET") {
    const { data } = await supabase.from("transactions").select("*").limit(10);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  }

  // پاسخ پیش‌فرض برای مسیرهای ناشناخته
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ detail: "Not found" })
  };
};