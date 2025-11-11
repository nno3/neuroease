const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const GameSession = sequelize.define('GameSession', {
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
    gameType: {
        type: DataTypes.ENUM('memory', 'math', 'sequencing'),
        allowNull: false
    },
    score: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER, // in seconds
        allowNull: false
    },
    accuracy: {
        type: DataTypes.FLOAT, // percentage
        allowNull: true
    },
    playedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'game_sessions',
    indexes: [
        {
            fields: ['patientId']
        },
        {
            fields: ['gameType']
        },
        {
            fields: ['playedAt']
        }
    ]
});

// Relationships
GameSession.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
User.hasMany(GameSession, { foreignKey: 'patientId', as: 'gameSessions' });

module.exports = GameSession;