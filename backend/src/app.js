const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

// Initialize express app
const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://refactored-acorn-g56qp9w79w7fppgq-5173.app.github.dev',
  'https://refactored-acorn-g56qp9w79w7fppgq-5173.app.github.dev:5173',
  'https://trasimu.onrender.com',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Static files (assuming we keep the same structure for frontend files)
app.use('/static', express.static(path.join(__dirname, '../../frontend/dist')));

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Payment Simulator API!' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;