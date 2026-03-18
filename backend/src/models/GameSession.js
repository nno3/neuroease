const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedGetter, encryptedSetter, encryptedNumberGetter, encryptedNumberSetter } = require('../utils/encryption');

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
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('gameType'),
        set: encryptedSetter('gameType'),
    },
    score: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('score'),
        set: encryptedNumberSetter('score'),
    },
    duration: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedNumberGetter('duration'),
        set: encryptedNumberSetter('duration'),
    },
    accuracy: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedNumberGetter('accuracy'),
        set: encryptedNumberSetter('accuracy'),
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