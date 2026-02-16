/**
 * NeuroEase Backend – Express server entry point.
 * Mounts API routes, connects to PostgreSQL via Sequelize, and handles 404/500.
 * Environment: .env (PORT, DB_*, JWT_SECRET, SMTP_*, PATIENT_APP_URL, FRONTEND_URL).
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize, User } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 5001;

// Log every API request (method, URL, status) for debugging and auditing
app.use(morgan('combined'));

// Allow frontend(s) on different origins to call this API; parse JSON and form bodies
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount route modules under /api/* (all require valid DB and env)
const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authRoutes);

const patientRoutes = require('./src/routes/patientRoutes');
app.use('/api/patients', patientRoutes);

const reminderRoutes = require('./src/routes/reminderRoutes');
app.use('/api/reminders', reminderRoutes);

const activityRoutes = require('./src/routes/activityRoutes');
app.use('/api/activity', activityRoutes);

const locationRoutes = require('./src/routes/locationRoutes');
app.use('/api/location', locationRoutes);

const safeZoneRoutes = require('./src/routes/safeZoneRoutes');
app.use('/api/safe-zones', safeZoneRoutes);

// Quick check for deployment and monitoring
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'NeuroEase Backend is running',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
        environment: process.env.NODE_ENV
    });
});
// No route matched – return consistent JSON so frontend can show a clear message
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Connect to DB, sync models (create/alter tables), then listen
const startServer = async () => {
    try {
        console.log('Testing database connection...');
        await sequelize.authenticate();
        console.log('PostgreSQL connection established successfully');

        // alter: true updates columns if model changed; avoids dropping data
        console.log('Syncing database tables...');
        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized');

        // Start server
        app.listen(PORT, () => {
            console.log(`NeuroEase Backend running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
            console.log('API request logging: ENABLED');
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();