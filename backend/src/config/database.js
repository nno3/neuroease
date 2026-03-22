/**
 * Sequelize instance for PostgreSQL.
 * Uses DATABASE_URL if set (Supabase, Render, etc.); otherwise DB_* from .env.
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const opts = {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
};

const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, { ...opts, dialectOptions: process.env.DATABASE_SSL === '1' ? { ssl: { rejectUnauthorized: false } } : {} })
    : new Sequelize(
          process.env.DB_NAME,
          process.env.DB_USER,
          process.env.DB_PASSWORD,
          { host: process.env.DB_HOST, port: process.env.DB_PORT, ...opts }
      );

// Test database connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        const db = process.env.DATABASE_URL ? 'cloud' : (process.env.DB_NAME || 'local');
        console.log(' PostgreSQL connection established successfully.');
        console.log(` Database: ${db}`);
    } catch (error) {
        console.error(' Unable to connect to PostgreSQL database:');
        console.error('   Please check your database configuration in .env');
        console.error('   Error details:', error.message);
    }
};

testConnection();

module.exports = sequelize;