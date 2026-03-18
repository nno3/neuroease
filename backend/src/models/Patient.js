const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedGetter, encryptedSetter } = require('../utils/encryption');

const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    dateOfBirth: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('dateOfBirth'),
        set: encryptedSetter('dateOfBirth'),
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('address'),
        set: encryptedSetter('address'),
    },
    gender: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('gender'),
        set: encryptedSetter('gender'),
    },
    phoneNumber: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('phoneNumber'),
        set: encryptedSetter('phoneNumber'),
    },
    preferredCommunication: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('preferredCommunication'),
        set: encryptedSetter('preferredCommunication'),
    },

    careNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('careNotes'),
        set: encryptedSetter('careNotes'),
    },
    emergencyContactName: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('emergencyContactName'),
        set: encryptedSetter('emergencyContactName'),
    },
    emergencyContactRelationship: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('emergencyContactRelationship'),
        set: encryptedSetter('emergencyContactRelationship'),
    },
    emergencyContactPhone: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('emergencyContactPhone'),
        set: encryptedSetter('emergencyContactPhone'),
    },
    emergencyContact: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('emergencyContact'),
        set: encryptedSetter('emergencyContact'),
    },
    medicalConditions: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('medicalConditions'),
        set: encryptedSetter('medicalConditions'),
    },
    medicalHistory: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('medicalHistory'),
        set: encryptedSetter('medicalHistory'),
    },
    locationConsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    reminderNotificationChannel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'none',
        field: 'reminder_notification_channel'
    }
}, {
    tableName: 'patients'
});

Patient.associate = function(models) {
    Patient.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = Patient;