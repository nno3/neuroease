const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize, User } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 5001;
// API request logging
app.use(morgan('combined'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
const authRoutes = require('./src/routes/authRoutes')
app.use('/api/auth', authRoutes);

const patientRoutes = require('./src/routes/patientRoutes');
app.use('/api/patients', patientRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'NeuroEase Backend is running',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
        environment: process.env.NODE_ENV
    });
});
// Handle 404
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

// Initialize database and start server
const startServer = async () => {
    try {
        console.log('Testing database connection...');

        // Test database connection
        await sequelize.authenticate();
        console.log('PostgreSQL connection established successfully');

        // Sync database tables (creates missing tables)
        console.log('Syncing database tables...');
        await sequelize.sync({ force: false }); // Use { force: true } only in development to reset DB
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