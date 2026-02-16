/**
 * Sequelize instance for PostgreSQL. Uses DB_* from .env. Exported for models and server.
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: console.log, // Show SQL queries in development
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Test database connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log(' PostgreSQL connection established successfully.');
        console.log(` Database: ${process.env.DB_NAME}`);
    } catch (error) {
        console.error(' Unable to connect to PostgreSQL database:');
        console.error('   Please check your database configuration in .env');
        console.error('   Error details:', error.message);
    }
};

testConnection();

module.exports = sequelize;