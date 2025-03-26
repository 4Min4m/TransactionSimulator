import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const loginHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;


    console.log("Received:", { username, password });
    
    // اعتبارسنجی ساده
    if (username !== "admin" || password !== "password") {
      res.status(401).json({ detail: "Invalid credentials" });
      return;
    }

    const user = { id: 1, username: "admin", role: "admin" };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (error) {
    next(error);
  }
};

router.post("/login", loginHandler);

export default router;