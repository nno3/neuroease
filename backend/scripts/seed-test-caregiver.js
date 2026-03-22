#!/usr/bin/env node
/**
 * Create a dedicated usability testing caregiver account.
 * Run from backend/: node scripts/seed-test-caregiver.js
 *
 * Creates user with email test.caregiver@neuroease.test and name "Usability Test Caregiver".
 * Safe to run multiple times (skips if user already exists).
 *
 * Then set TEST_CAREGIVER_EMAIL=test.caregiver@neuroease.test in backend .env
 * (or TEST_CAREGIVER_ID to the printed user ID).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const { hashEmail } = require('../src/utils/encryption');
const { User, sequelize } = require('../src/models');

const TEST_EMAIL = 'na429@student.le.ac.uk';
const TEST_NAME = 'Usability Test Caregiver';
const TEST_PASSWORD = 'Test123!';

async function main() {
  try {
    await sequelize.authenticate();

    const existing = await User.findOne({ where: { emailHash: hashEmail(TEST_EMAIL) } });
    if (existing) {
      process.exit(0);
      return;
    }

    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await User.create({
      email: TEST_EMAIL,
      password: hashedPassword,
      name: TEST_NAME,
      userType: 'caregiver',
      isEmailVerified: true,
    });

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
