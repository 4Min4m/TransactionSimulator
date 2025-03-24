// backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes for the transaction simulator
app.post('/api/process-transaction', (req, res) => {
  const { card_number, amount, merchant_id } = req.body;
  
  // Your transaction processing logic here
  // For now, let's send a mock response
  res.json({
    success: true,
    message: "Transaction processed successfully",
    data: {
      // Mock ISO8583 message data
      mti: "0200",
      primaryAccountNumber: card_number.substring(0, 6) + "******" + card_number.substring(card_number.length - 4),
      processingCode: "000000",
      amount: amount,
      transmissionDateTime: new Date().toISOString(),
      systemTraceNumber: Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      localTransactionTime: new Date().toTimeString().substring(0, 8).replace(/:/g, ''),
      localTransactionDate: new Date().toISOString().substring(0, 10).replace(/-/g, ''),
      merchantType: "5411",
      responseCode: "00",
      terminalId: "TERM001",
      merchantId: merchant_id
    },
    responseCode: "00", 
    authorizationCode: "AUTH" + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  });
});

app.post('/api/process-batch', (req, res) => {
  const { total_transactions, total_amount, duration_seconds, merchant_id } = req.body;
  
  // Mock batch processing
  res.json({
    success: true,
    message: `Processed ${total_transactions} transactions`,
    successCount: Math.floor(total_transactions * 0.95), // 95% success rate
    failureCount: Math.ceil(total_transactions * 0.05), // 5% failure rate
  });
});

app.get('/api/transactions', (req, res) => {
  // Return mock transaction history
  res.json([
    {
      id: "tx_1",
      date: new Date().toISOString(),
      amount: 125.50,
      merchant: "MERCH001",
      status: "approved"
    },
    {
      id: "tx_2",
      date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      amount: 75.25,
      merchant: "MERCH002",
      status: "approved"
    }
  ]);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});