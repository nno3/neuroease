const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const SafeZone = sequelize.define('SafeZone', {
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
        type: DataTypes.INTEGER, // in meters
        allowNull: false,
        defaultValue: 100
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'safe_zones',
    indexes: [
        {
            fields: ['patientId']
        },
        {
            fields: ['isActive']
        }
    ]
});

// Relationships
SafeZone.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
User.hasMany(SafeZone, { foreignKey: 'patientId', as: 'safeZones' });

module.exports = SafeZone;