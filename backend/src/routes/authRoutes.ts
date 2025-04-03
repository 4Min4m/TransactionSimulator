import { Router, Request, Response, NextFunction } from "express";

const router = Router();

// یوزر ادمین تستی
const TEST_ADMIN = {
  username: "admin",
  password: "password123",
};

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    // مطمئن شو که فیلدها وجود دارن
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    // چک کردن یوزرنیم و پسورد (غیرحساس به حروف بزرگ و کوچک)
    if (
      username.toLowerCase() === TEST_ADMIN.username.toLowerCase() &&
      password === TEST_ADMIN.password
    ) {
      return res.status(200).json({ success: true, message: "Login successful" });
    }

    return res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (error: any) {
    next(error);
  }
});

export default router;