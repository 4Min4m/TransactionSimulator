const express = require('express');
const transactionRoutes = require('./transactionRoutes');
const batchRoutes = require('./batchRoutes');

const router = express.Router();

// Register route modules
router.use('/transactions', transactionRoutes);
router.use('/batch', batchRoutes);

// Re-export for direct access from app.js
module.exports = router;