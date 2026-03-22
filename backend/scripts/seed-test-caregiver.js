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

const TEST_EMAIL = 'test.caregiver@neuroease.test';
const TEST_NAME = 'Usability Test Caregiver';
const TEST_PASSWORD = 'TestPass123!';

async function main() {
  try {
    await sequelize.authenticate();

    const existing = await User.findOne({ where: { emailHash: hashEmail(TEST_EMAIL) } });
    if (existing) {
      console.log(`Test caregiver already exists: id=${existing.id}, email=${TEST_EMAIL}`);
      console.log('Set TEST_CAREGIVER_EMAIL=test.caregiver@neuroease.test or TEST_CAREGIVER_ID=' + existing.id);
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

    console.log('Created usability test caregiver:');
    console.log('  id:', user.id);
    console.log('  email:', TEST_EMAIL);
    console.log('  name:', TEST_NAME);
    console.log('');
    console.log('Add to backend .env:');
    console.log('  TEST_CAREGIVER_EMAIL=test.caregiver@neuroease.test');
    console.log('  (or TEST_CAREGIVER_ID=' + user.id + ')');
    console.log('');
    console.log('Then use "Skip to testing" on the caregiver login page.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
