"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const batchService_1 = require("../services/batchService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// مسیر محافظت‌شده
router.post("/process-batch", auth_1.authenticateToken, async (req, res, next) => {
    try {
        const batch = req.body;
        const response = await (0, batchService_1.processBatch)(batch);
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
});
// مسیر عمومی
router.post("/public/process-batch", async (req, res, next) => {
    try {
        const batch = req.body;
        const response = await (0, batchService_1.processBatch)(batch);
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
