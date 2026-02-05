const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Patient = require('./Patient');
const Reminder = require('./Reminder');
const GameSession = require('./GameSession');
const LocationLog = require('./LocationLog');
const SafeZone = require('./SafeZone');
const LocationAlert = require('./LocationAlert');

// Initialize all models first
const models = {
  User,
  Patient,
  Reminder,
  GameSession,
  LocationLog,
  SafeZone,
  LocationAlert
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
  ...models
};