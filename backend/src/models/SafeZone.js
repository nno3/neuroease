const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedGetter, encryptedSetter, encryptedNumberGetter, encryptedNumberSetter } = require('../utils/encryption');

const SafeZone = sequelize.define('SafeZone', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patientId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'Home',
        get: encryptedGetter('name'),
        set: encryptedSetter('name'),
    },
    centerLat: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('centerLat'),
        set: encryptedNumberSetter('centerLat'),
    },
    centerLng: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('centerLng'),
        set: encryptedNumberSetter('centerLng'),
    },
    radius: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'safe_zones'
});

SafeZone.associate = function(models) {
    SafeZone.belongsTo(models.User, { foreignKey: 'patientId', as: 'patient' });
};

module.exports = SafeZone;