import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

router.post("/login", (req: Request, res: Response) => {
  // test a user
  const user = { id: 1, username: "testuser" };

  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

export default router;