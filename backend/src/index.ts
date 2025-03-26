import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import transactionRoutes from "./routes/transactionRoutes";
import batchRoutes from "./routes/batchRoutes";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { authenticateToken } from "./middleware/auth";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers } from "./graphql/schema";

// loading environments
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Middleware parsing JSON
app.use(express.json());

// set up CORS
app.use((req: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// routes
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the Payment Simulator API!" });
});

app.use("/api", authRoutes);
app.use("/api", transactionRoutes);
app.use("/api", batchRoutes);

// set Apollo Server for GraphQL
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});

(async () => {
  await apolloServer.start();
  app.use(
    "/graphql",
    authenticateToken,
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ req }),
    })
  );
})();

// Middleware management
app.use(errorHandler);

// start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`GraphQL endpoint available at http://localhost:${PORT}/graphql`);
});