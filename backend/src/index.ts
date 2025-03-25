import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import transactionRoutes from "./routes/transactionRoutes";
import batchRoutes from "./routes/batchRoutes";
import { errorHandler } from "./middleware/errorHandler";

// Loading env
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Middleware for parsing JSON
app.use(express.json());

// set up CORS
app.use((req: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // specify Domain
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// routes
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the Payment Simulator API!" });
});

app.use("/api", transactionRoutes);
app.use("/api", batchRoutes);

// Middleware managing errors
app.use(errorHandler);

// start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});