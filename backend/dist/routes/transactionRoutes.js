"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionService_1 = require("../services/transactionService");
const supabaseService_1 = require("../services/supabaseService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const processTransactionHandler = async (req, res, next) => {
    try {
        const transaction = req.body;
        const response = await (0, transactionService_1.processTransaction)(transaction);
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
};
const getTransactionsHandler = async (req, res, next) => {
    try {
        const transactions = await (0, supabaseService_1.getTransactions)();
        res.status(200).json(transactions);
    }
    catch (error) {
        next(error);
    }
};
router.post("/process-transaction", auth_1.authenticateToken, processTransactionHandler);
router.get("/transactions", auth_1.authenticateToken, getTransactionsHandler);
exports.default = router;
