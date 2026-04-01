const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { encryptedGetter, encryptedSetter } = require('../utils/encryption');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    receiverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('content'),
        set: encryptedSetter('content'),
    },
    /** 'message' | 'meeting_request' */
    type: {
        type: DataTypes.ENUM('message', 'meeting_request'),
        defaultValue: 'message',
    },
    /** ISO string — only set for meeting_request type */
    meetingTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'meeting_time',
    },
    /** 'pending' | 'accepted' | 'declined' — only relevant for meeting_request */
    meetingStatus: {
        type: DataTypes.ENUM('pending', 'accepted', 'declined'),
        allowNull: true,
        field: 'meeting_status',
    },
    isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_read',
    },
}, {
    tableName: 'messages',
});

Message.associate = function (models) {
    Message.belongsTo(models.User, { as: 'sender', foreignKey: 'senderId' });
    Message.belongsTo(models.User, { as: 'receiver', foreignKey: 'receiverId' });
};

module.exports = Message;
