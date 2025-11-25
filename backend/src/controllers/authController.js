const User = require('../models/User');
const jwt = require('jsonwebtoken');

const authController = {
    register: async (req, res) => {
        try {
            const { email, password, name, userType } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'A user with this email already exists'
                });
            }
            // Create user (password automatically hashed by model hook)
            const user = await User.create({
                email,
                password,// This will be hashed by the beforeCreate hook
                name,
                userType
            });
            const token = jwt.sign(
                { userId: user.id, userType: user.userType },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        userType: user.userType,
                        createdAt: user.createdAt
                    },
                    token
                }
            });
        } catch (error) {
            // Handle Sequelize unique constraint error
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({
                    success: false,
                    message: 'A user with this email already exists'
                });
            }

            // Handle validation errors from model
            if (error.name === 'SequelizeValidationError') {
                const validationErrors = error.errors.map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

        // Generic error
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    },


    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            const isValidPassword = await user.validatePassword(password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            const token = jwt.sign(
                { userId: user.id, userType: user.userType },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        userType: user.userType
                    },
                    token
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during login',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = authController;