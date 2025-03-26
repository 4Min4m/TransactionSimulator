"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const loginHandler = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        console.log("Received:", { username, password });
        // اعتبارسنجی ساده
        if (username !== "admin" || password !== "password") {
            res.status(401).json({ detail: "Invalid credentials" });
            return;
        }
        const user = { id: 1, username: "admin", role: "admin" };
        const token = jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
};
router.post("/login", loginHandler);
exports.default = router;
