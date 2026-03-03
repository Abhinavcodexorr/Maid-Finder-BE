require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require('./config/constants');

connectDB().catch(() => {});

const app = express();

// Security
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "http://65.1.116.194",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    message: { success: false, message: 'Too many requests. Please try again later.' },
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

const PORT = parseInt(process.env.PORT, 10) || 5000;

function startServer(port, maxAttempts = 5) {
  if (maxAttempts <= 0) {
    console.error('No available port. Stop other processes or change PORT in .env');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`Maid Finder API running on port ${port} (${process.env.NODE_ENV || 'development'})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, maxAttempts - 1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);