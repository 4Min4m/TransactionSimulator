import { Request, Response, NextFunction } from "express";

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  // فقط پیام خطا رو لاگ کن، نه کل stack trace
  console.error(`Error processing ${req.method} ${req.url}:`, error.message);

  // پاسخ به کلاینت
  res.status(500).json({
    detail: error.message || "Internal Server Error",
    path: req.url,
    method: req.method,
  });
};