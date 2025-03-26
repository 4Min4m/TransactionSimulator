import { Router, Request, Response } from "express";
import { processTransaction } from "../services/transactionService";
import { getTransactions } from "../services/supabaseService";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/process-transaction", authenticateToken, async (req: Request, res: Response) => {
  try {
    const transaction = req.body;
    const response = await processTransaction(transaction);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ detail: error.message });
  }
});

router.get("/transactions", authenticateToken, async (req: Request, res: Response) => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (error: any) {
    res.status(500).json({ detail: error.message });
  }
});

export default router;