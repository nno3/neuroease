const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
        type: DataTypes.DATE,
        allowNull: true
    },

    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    gender: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    phoneNumber: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    // Care & Emergency – structured fields
    preferredCommunication: {
        type: DataTypes.STRING(50),
        allowNull: true
    },

    careNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emergencyContactName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    emergencyContactRelationship: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    emergencyContactPhone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    emergencyContact: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    medicalConditions: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    medicalHistory: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    locationConsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'patients'
});

Patient.associate = function(models) {
    Patient.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = Patient;