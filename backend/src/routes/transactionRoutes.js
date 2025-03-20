const express = require('express');
const { processTransaction } = require('../services/transactionService');
const { validateTransactionRequest } = require('../models/Transaction');
const supabase = require('../config/supabaseClient');

const router = express.Router();

/**
 * Process a single transaction
 * @route POST /api/transactions/process
 */
router.post('/process', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = validateTransactionRequest(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    // Process the transaction
    const response = await processTransaction(value);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * Get all transactions
 * @route GET /api/transactions
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('transactions').select('*');
    
    if (error) {
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;