const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LocationLog = sequelize.define('LocationLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patientId: {
        type: DataTypes.INTEGER,
        allowNull: false
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
        type: DataTypes.FLOAT,
        allowNull: true
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'location_logs'
});

LocationLog.associate = function(models) {
    LocationLog.belongsTo(models.User, { foreignKey: 'patientId', as: 'patient' });
};

module.exports = LocationLog;