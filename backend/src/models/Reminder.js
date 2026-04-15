const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedGetter, encryptedSetter } = require('../utils/encryption');

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
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('title'),
        set: encryptedSetter('title'),
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('message'),
        set: encryptedSetter('message'),
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
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    recurrence: {
        type: DataTypes.ENUM('once', 'daily', 'weekly'),
        defaultValue: 'once'
    },
    reminderEmailSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reminder_email_sent_at'
    },
    overdueNotificationSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'overdue_notification_sent_at'
    }
}, {
    tableName: 'reminders'
});

Reminder.associate = function(models) {
    Reminder.belongsTo(models.User, { foreignKey: 'patientId' });
};

module.exports = Reminder;