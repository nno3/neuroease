/**
 * Jest – load env before any test files (same variables as local dev / CI secrets).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
