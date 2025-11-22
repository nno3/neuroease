const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameSession = sequelize.define('GameSession', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patientId: {
        type: DataTypes.INTEGER,
        allowNull: false
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
        type: DataTypes.INTEGER,
        allowNull: false
    },
    accuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    playedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'game_sessions'
});

GameSession.associate = function(models) {
    GameSession.belongsTo(models.User, { foreignKey: 'patientId', as: 'patient' });
};

module.exports = GameSession;