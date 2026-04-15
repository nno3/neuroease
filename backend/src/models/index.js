/**
 * Central model registry – loads all Sequelize models and runs associate() so relationships
 * (User–Patient, Reminder–User, etc.) are set up without circular dependency issues.
 */
const sequelize = require('../config/database');

const User = require('./User');
const Patient = require('./Patient');
const Reminder = require('./Reminder');
const GameSession = require('./GameSession');
const LocationLog = require('./LocationLog');
const SafeZone = require('./SafeZone');
const LocationAlert = require('./LocationAlert');
const PushSubscription = require('./PushSubscription');
const Message = require('./Message');

// Initialize all models first
const models = {
  User,
  Patient,
  Reminder,
  GameSession,
  LocationLog,
  SafeZone,
  LocationAlert,
  PushSubscription,
  Message,
};

// Set up associations - this must happen AFTER all models are loaded
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Export everything
module.exports = {
  sequelize,
  ...models,
};