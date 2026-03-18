const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedNumberGetter, encryptedNumberSetter } = require('../utils/encryption');

const LocationAlert = sequelize.define('LocationAlert', {
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
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('latitude'),
        set: encryptedNumberSetter('latitude'),
    },
    longitude: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('longitude'),
        set: encryptedNumberSetter('longitude'),
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    message: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Left safe zone'
    }
}, {
    tableName: 'location_alerts'
});

LocationAlert.associate = function (models) {
    LocationAlert.belongsTo(models.User, { foreignKey: 'patientId', as: 'patient' });
};

module.exports = LocationAlert;
