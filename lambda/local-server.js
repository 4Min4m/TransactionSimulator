// Local development server: runs the real Lambda handlers behind a tiny HTTP
// server, with the in-memory store and the JWT authorizer applied to the same
// routes API Gateway protects. No AWS account or Supabase project needed.
//
//   npm run dev:api          # http://localhost:3001  (login: admin / admin)
//   cd ../frontend && VITE_API_BASE_URL=http://localhost:3001 npm run dev
//
// Not deployed: excluded from the Lambda package in terraform/main.tf.

const http = require("http");
const bcrypt = require("bcryptjs");

const PORT = Number(process.env.PORT || 3001);
Object.assign(process.env, {
  DATA_STORE: "memory",
  JWT_SECRET: process.env.JWT_SECRET || "local-dev-secret",
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || "admin",
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync("admin", 10),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:5173",
});

const { handler } = require("./lambda");
const { handler: authorize } = require("./authorizer");

const isPublic = (method, path) => method === "OPTIONS" || (method === "POST" && path === "/api/login");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const event = {
    httpMethod: req.method,
    path: url.pathname,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: chunks.length ? Buffer.concat(chunks).toString("utf8") : null,
  };

  let result;
  try {
    if (!isPublic(req.method, url.pathname)) {
      await authorize({
        authorizationToken: req.headers.authorization || "",
        methodArn: `arn:aws:execute-api:local:000000000000:local/dev/${req.method}${url.pathname}`,
      });
    }
    result = await handler(event);
  } catch {
    result = {
      statusCode: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS.split(",")[0] },
      body: JSON.stringify({ message: "Unauthorized" }),
    };
  }
  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
});

server.listen(PORT, () => console.log(`Local API on http://localhost:${PORT} (login: admin / admin)`));
