import { Router, Request, Response } from "express";
import { processBatch } from "../services/batchService";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/process-batch", authenticateToken, async (req: Request, res: Response) => {
  try {
    const batch = req.body;
    const response = await processBatch(batch);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ detail: error.message });
  }
});

export default router;