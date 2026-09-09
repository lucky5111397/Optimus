require('dotenv').config();
const { validateEnv } = require('./config/env');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { disconnectDB } = require('./config/db');
const { initializeFirebase } = require('./config/firebase');

// Validate environment configuration
validateEnv();

// Import routes
const authRoutes = require('./routes/auth');
const repositoriesRoutes = require('./routes/repositories');
const tasksRoutes = require('./routes/tasks');
const apiRoutes = require('./routes/api');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhooks');
const { authLimiter, taskLimiter, webhookLimiter } = require('./middleware/rateLimit');

const mongoose = require('mongoose');
const aiGateway = require('./ai/gateway');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase
initializeFirebase();

// Standard HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Allowed origins for CORS (supporting both localhost and 127.0.0.1 in development)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());

// Health check (public)
// Health check (public, backward-compatible)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend is healthy' });
});

// Liveness probe
app.get('/api/health/live', (req, res) => {
  res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (verifies database & gateway readiness without leaking secrets)
app.get('/api/health/ready', (req, res) => {
  const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
  let isAiGatewayReady = false;
  try {
    isAiGatewayReady = Boolean(aiGateway && aiGateway.getProvider && aiGateway.getProvider('openrouter'));
  } catch (_) {
    isAiGatewayReady = false;
  }

  if (isDbReady) {
    return res.status(200).json({
      status: 'READY',
      db: 'CONNECTED',
      aiGateway: isAiGatewayReady ? 'READY' : 'DEGRADED'
    });
  }

  return res.status(503).json({
    status: 'NOT_READY',
    db: 'DISCONNECTED',
    aiGateway: isAiGatewayReady ? 'READY' : 'DEGRADED'
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/tasks', taskLimiter, tasksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);
app.use('/api', apiRoutes);

// Error handling middleware (sanitized for production security)
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message || err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : (err.message || 'An unexpected error occurred.')
    }
  });
});

const { reconcileStaleExecutions } = require('./services/recoveryService');
const { abortAllActiveExecutions } = require('./services/executionService');

const startServer = async () => {
  try {
    await connectDB();

    // Reconcile stale / orphaned executions after server crash or restart
    try {
      const recoveryResults = await reconcileStaleExecutions();
      if (recoveryResults.recoveredExecutions > 0 || recoveryResults.recoveredDeliveries > 0) {
        console.log('[Recovery] Successfully reconciled orphaned states on startup:', recoveryResults);
      }
    } catch (recErr) {
      console.error('[Recovery] Error reconciling stale executions:', recErr.message);
    }

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down cleanly...`);
      abortAllActiveExecutions();
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message || error);
    process.exit(1);
  }
};

startServer();

