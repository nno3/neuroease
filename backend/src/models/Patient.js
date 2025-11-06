const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    dateOfBirth: {
        type: DataTypes.DATE,
        allowNull: true
    },
    emergencyContact: {
        type: DataTypes.STRING,
        allowNull: true
    },
    medicalConditions: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'patients'
});

// Define relationships
Patient.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Patient, { foreignKey: 'userId' });

module.exports = Patient;