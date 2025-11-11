const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userType: {
        type: DataTypes.ENUM('caregiver', 'patient'),
        allowNull: false,
        field: 'user_type' // Maps to user_type column in database
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
    }
});

// Instance method to check password
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Class method to sync table
User.syncTable = async function() {
    try {
        await this.sync({ force: false }); // Use { force: true } to drop and recreate
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

module.exports = User;



module.exports = User;