import { Router, Request, Response, NextFunction } from "express";
import { processBatch } from "../services/batchService";

const router = Router();

// مسیر محافظت‌شده
router.post("/process-batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batch = req.body;
    const response = await processBatch(batch);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});

// مسیر عمومی
router.post("/public/process-batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batch = req.body;
    const response = await processBatch(batch);
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});

export default router;