/**
 * User model – caregivers and patients. Stores credentials, email verification,
 * and for patients: invite token (activate) and magic-link token (login).
 * Passwords hashed with bcrypt; validatePassword() used at login.
 * Name is encrypted at rest when ENCRYPTION_KEY is set.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');
const { encryptedGetter, encryptedSetter, hashEmail } = require('../utils/encryption');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('email'),
        set(value) {
            const normalized = value != null && value !== '' ? String(value).trim().toLowerCase() : null;
            if (normalized) {
                const { encrypt } = require('../utils/encryption');
                this.setDataValue('email', encrypt(normalized));
                this.setDataValue('emailHash', hashEmail(normalized));
            } else {
                this.setDataValue('email', null);
                this.setDataValue('emailHash', null);
            }
        }
    },
    emailHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true,
        field: 'email_hash'
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: false,
        get: encryptedGetter('name'),
        set: encryptedSetter('name'),
    },
    userType: {
        type: DataTypes.ENUM('caregiver', 'patient'),
        allowNull: false,
        field: 'user_type' // Maps to user_type column in database
    },
    isEmailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_email_verified'
    },
    emailVerificationToken: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'email_verification_token'
    },
    emailVerificationTokenExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'email_verification_token_expires'
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'isArchived'
    },
    archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'archivedAt'
    },
    archiveReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('archiveReason'),
        set: encryptedSetter('archiveReason'),
    },
    archiveNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('archiveNotes'),
        set: encryptedSetter('archiveNotes'),
    },
    archivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    unarchivedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    unarchivedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    unarchiveNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        get: encryptedGetter('unarchiveNotes'),
        set: encryptedSetter('unarchiveNotes'),
    },
    avatar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Caregiver email notification preferences (JSON: { locationAlerts, missedReminders, gameCompletion })
    emailNotificationPreferences: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'email_notification_preferences'
    },
    // Patient invite (one-time activation)
    inviteToken: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'invite_token'
    },
    inviteTokenExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'invite_token_expires'
    },
    // Patient magic link (login)
    magicLinkToken: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'magic_link_token'
    },
    magicLinkTokenExpires: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'magic_link_token_expires'
    },
    magicLinkShortCode: {
        type: DataTypes.STRING(10),
        allowNull: true,
        field: 'magic_link_short_code'
    }
}, {
    tableName: 'users',
        hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
            beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    },
});
// Instance method to check password
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Class method to sync table
User.syncTable = async function() {
    try {
        await sequelize.sync(); // Use { force: true } to drop and recreate
        console.log(' Users table synced successfully');
    } catch (error) {
        console.error(' Error syncing users table:', error);
    }
};

const Patient = require('./Patient');
const Reminder = require('./Reminder');
const GameSession = require('./GameSession');
const LocationLog = require('./LocationLog');
const SafeZone = require('./SafeZone');

// Caregiver-Patient relationship (Many-to-Many through a join table)
User.belongsToMany(User, {
    through: 'caregiver_patients',
    as: 'patients',
    foreignKey: 'caregiverId',
    otherKey: 'patientId'
});

User.belongsToMany(User, {
    through: 'caregiver_patients',
    as: 'caregivers',
    foreignKey: 'patientId',
    otherKey: 'caregiverId'
});

User.associate = function(models) {
    User.hasOne(models.Patient, { foreignKey: 'userId' });
    User.hasMany(models.Reminder, { foreignKey: 'patientId', as: 'reminders' });
    User.hasMany(models.GameSession, { foreignKey: 'patientId', as: 'gameSessions' });
    User.hasMany(models.LocationLog, { foreignKey: 'patientId', as: 'locationLogs' });
    User.hasMany(models.SafeZone, { foreignKey: 'patientId', as: 'safeZones' });
    User.hasMany(models.PushSubscription, { foreignKey: 'userId', as: 'pushSubscriptions' });
};

module.exports = User;

