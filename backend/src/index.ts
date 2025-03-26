import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import transactionRoutes from "./routes/transactionRoutes";
import batchRoutes from "./routes/batchRoutes";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers } from "./graphql/schema";
import { json } from "body-parser";

dotenv.config({ path: "./.env" });

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

const app: Express = express();
const PORT = process.env.PORT || 8000;

// تنظیم CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin === process.env.FRONTEND_URL || origin === "http://localhost:5173") {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the Payment Simulator API!" });
});

app.use("/api", authRoutes);
app.use("/api", transactionRoutes);
app.use("/api", batchRoutes);

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  const httpServer = http.createServer(app);
  await apolloServer.start();
  app.use(
    "/graphql",
    json(),
    authenticateToken,
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => ({
        req,
        res,
      }),
    })
  );
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🚀 GraphQL endpoint at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch(console.error);

app.use(errorHandler);