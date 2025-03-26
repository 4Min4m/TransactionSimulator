import { Router, Request, Response, NextFunction } from "express";
import { processBatch } from "../services/batchService";
import { authenticateToken } from "../middleware/auth";

const router = Router();

const processBatchHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batch = req.body;
    const response = await processBatch(batch);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
};

router.post("/process-batch", authenticateToken, processBatchHandler);

export default router;