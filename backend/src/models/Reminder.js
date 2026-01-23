const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reminder = sequelize.define('Reminder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patientId: {
        type: DataTypes.INTEGER,
        allowNull: false
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
    endTime: {
        type: DataTypes.DATE,
        allowNull: true  // Optional field
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
    tableName: 'reminders'
});

module.exports = Reminder;