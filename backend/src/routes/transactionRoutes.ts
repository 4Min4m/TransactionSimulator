import { Router, Request, Response, NextFunction } from "express";
import { processTransaction } from "../services/transactionService";
import { getTransactions } from "../services/supabaseService";
import { authenticateToken } from "../middleware/auth";

const router = Router();

const processTransactionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transaction = req.body;
    const response = await processTransaction(transaction);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
};

const getTransactionsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (error: any) {
    next(error);
  }
};

router.post("/process-transaction", authenticateToken, processTransactionHandler);
router.get("/transactions", authenticateToken, getTransactionsHandler);

export default router;