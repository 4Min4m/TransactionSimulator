import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import http from "http";
import dotenv from "dotenv";
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

const app: Express = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

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
  // Create HTTP server
  const httpServer = http.createServer(app);

  // Start Apollo Server
  await apolloServer.start();

  // Apply middleware
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

  // Start the server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🚀 GraphQL endpoint at http://localhost:${PORT}/graphql`);
  });
}

// Call the async function to start the server
startServer().catch(console.error);

// Error handling middleware
app.use(errorHandler);