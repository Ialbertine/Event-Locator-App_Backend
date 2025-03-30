const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initializeDatabase } = require('./config/db');
const { initializeI18n, i18nMiddleware } = require('./config/i18n');
const { connectRedis, redisCacheInstance } = require('./config/redis');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const createNotificationsTable = require('./migrations/notificationTable'); 

const app = express();

// Enhanced Initialization
async function initializeApp() {
  try {
    console.log('[Init] Starting database...');
    await initializeDatabase();
    console.log('[Init] Database OK');
    
    // Create notifications table
    console.log('[Init] Creating notifications table...');
    await createNotificationsTable();
    console.log('[Init] Notifications table OK');

    console.log('[Init] Connecting to Redis...');
    await connectRedis();
    
    // Verify Redis connection
    const redisReady = await redisCacheInstance.ensureConnected();
    if (!redisReady) throw new Error('Redis connection verification failed');
    console.log('[Init] Redis OK');

    console.log('[Init] Initializing i18n...');
    await initializeI18n();
    console.log('[Init] i18n OK');
    
    // Load notification service
    console.log('[Init] Setting up notification service...');
    require('./services/notificationService');
    console.log('[Init] Notification service OK');
  } catch (err) {
    console.error('[Init] FAILED:', {
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(i18nMiddleware());

// Health Check
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: Date.now(),
    redis: await redisCacheInstance.ensureConnected(),
    uptime: process.uptime()
  };
  res.status(health.redis ? 200 : 503).json(health);
});

// Routes
app.get('/', (req, res) => res.send('Server is running'));
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes); 

// Error Handling
app.use(require('./middlewares/errorHandler'));

// Start Server
const PORT = process.env.PORT || 5000;
initializeApp().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });
}).catch(err => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

module.exports = app;