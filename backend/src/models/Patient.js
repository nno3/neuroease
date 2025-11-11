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

Patient.associate = function(models) {
    Patient.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = Patient;