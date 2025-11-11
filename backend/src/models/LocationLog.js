const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const LocationLog = sequelize.define('LocationLog', {
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
    latitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    longitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    accuracy: {
        type: DataTypes.FLOAT, // GPS accuracy in meters
        allowNull: true
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'location_logs',
    indexes: [
        {
            fields: ['patientId']
        },
        {
            fields: ['timestamp']
        },
        {
            fields: ['patientId', 'timestamp']
        }
    ]
});

// Relationships
LocationLog.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
User.hasMany(LocationLog, { foreignKey: 'patientId', as: 'locationLogs' });

module.exports = LocationLog;