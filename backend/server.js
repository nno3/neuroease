const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize, User } = require('./src/models');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'NeuroEase Backend is running',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL'
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
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();