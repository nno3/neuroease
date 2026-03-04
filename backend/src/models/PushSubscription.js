/**
 * PushSubscription – Web Push subscription per device for a patient (User).
 * Used to send reminder notifications when patient preference is "push".
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  p256dh: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  auth: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'updated_at',
  },
}, {
  tableName: 'push_subscriptions',
  underscored: true,
  indexes: [{ fields: ['user_id'] }],
});

PushSubscription.associate = function (models) {
  PushSubscription.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = PushSubscription;
