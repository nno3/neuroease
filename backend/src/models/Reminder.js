const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Reminder = sequelize.define('Reminder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    reminderType: {
        type: DataTypes.ENUM('medication', 'appointment', 'general'),
        allowNull: false,
        defaultValue: 'general'
    },
    scheduledTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isCompleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    recurrence: {
        type: DataTypes.ENUM('once', 'daily', 'weekly'),
        defaultValue: 'once'
    }
}, {
    tableName: 'reminders',
    indexes: [
        {
            fields: ['patientId']
        },
        {
            fields: ['scheduledTime']
        },
        {
            fields: ['patientId', 'scheduledTime']
        }
    ]
});

// Relationships
Reminder.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
User.hasMany(Reminder, { foreignKey: 'patientId', as: 'reminders' });

module.exports = Reminder;