require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initializeDatabase } = require('./config/db');
const { initializeI18n, i18nMiddleware } = require('./config/i18n');
const { connectRedis } = require('./config/redis');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Database and Redis initialization
async function initializeApp() {
    try {
        await initializeDatabase();
        await connectRedis();
        await initializeI18n();
        
        console.log('All systems initialized');
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(i18nMiddleware);

// Routes
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// Start server
const PORT = process.env.PORT || 5000;
initializeApp().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

module.exports = app;
