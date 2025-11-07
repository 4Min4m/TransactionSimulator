import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import transactionRoutes from "./routes/transactionRoutes";
import batchRoutes from "./routes/batchRoutes";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { typeDefs, resolvers } from "./graphql/schema";

// Load environment variables
dotenv.config({ path: "./.env" });

const app = express();

// Configure CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());
app.use(bodyParser.json());

app.use("/api", transactionRoutes);
app.use("/api", batchRoutes);
app.use("/api", authRoutes); 

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  await server.start();
  app.use("/graphql", expressMiddleware(server));
  app.use(errorHandler);

  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
}

startServer();
