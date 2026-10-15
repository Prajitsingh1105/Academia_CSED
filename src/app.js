const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for microservice orchestration (Kubernetes / Docker)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'academia-iam-auth-service',
    timestamp: new Date().toISOString(),
  });
});

// Mount IAM & Auth routes
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
