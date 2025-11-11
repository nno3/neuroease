const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Home'
    },
    centerLat: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    centerLng: {
        type: DataTypes.FLOAT,
        allowNull: false
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