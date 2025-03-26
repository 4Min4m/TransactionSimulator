import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  // simple validation
  if (username !== "admin" || password !== "password") {
    return res.status(401).json({ detail: "Invalid credentials" });
  }

  const user = { id: 1, username: "admin", role: "admin" };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

export default router;