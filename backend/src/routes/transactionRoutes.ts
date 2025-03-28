import { Router, Request, Response, NextFunction } from "express";
import { processTransaction } from "../services/transactionService";
import { getTransactions } from "../services/supabaseService";

const router = Router();

// مسیر محافظت‌شده (نیاز به توکن)
router.get("/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (error: any) {
    next(error);
  }
});

// مسیر عمومی (بدون نیاز به توکن)
router.get("/public/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await getTransactions();
    res.status(200).json(transactions);
  } catch (error: any) {
    next(error);
  }
});

// مسیرهای دیگه (مثل process-transaction) هم همین‌طور
router.post("/process-transaction", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = req.body;
    const response = await processTransaction(transaction);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});

router.post("/public/process-transaction", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = req.body;
    const response = await processTransaction(transaction);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});

export default router;