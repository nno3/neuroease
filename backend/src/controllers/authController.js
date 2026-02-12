const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('../utils/emailService');

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const authController = {
    register: async (req, res) => {
        try {
            const { email, password, name, userType } = req.body;
            const normalizedEmail = (email || '').trim().toLowerCase();

            const existingUser = await User.findOne({ where: { email: normalizedEmail } });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'A user with this email already exists'
                });
            }

            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

            const user = await User.create({
                email: normalizedEmail,
                password,
                name: (name || '').trim(),
                userType: userType || 'caregiver',
                isEmailVerified: false,
                emailVerificationToken: verificationToken,
                emailVerificationTokenExpires: verificationExpires
            });

            const emailResult = await sendVerificationEmail(user.email, user.name, verificationToken);
            if (!emailResult.sent && emailResult.error) {
                console.error('Verification email failed:', emailResult.error);
                // Still return success; they can use resend
            }

            res.status(201).json({
                success: true,
                message: 'Registration successful. Please check your email to verify your account before logging in.',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        userType: user.userType,
                        isEmailVerified: false
                    }
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
            const normalizedEmail = (email || '').trim().toLowerCase();

            const user = await User.findOne({ where: { email: normalizedEmail } });
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

            if (user.isEmailVerified === false) {
                return res.status(403).json({
                    success: false,
                    message: 'Please verify your email before logging in. Check your inbox for the verification link.',
                    code: 'EMAIL_NOT_VERIFIED'
                });
            }

            const token = jwt.sign(
                {userId: user.id, userType: user.userType},
                process.env.JWT_SECRET,
                {expiresIn: '7d'}
            );

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        userType: user.userType,
                        avatar: user.avatar || null
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
    },

    getProfile: async (req, res) => {
        try {
            const user = await User.findByPk(req.user.userId, {
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: { user }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching profile'
            });
        }
    },

    logout: async (req, res) => {
        try {
            res.json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { name, email, currentPassword, newPassword, avatar } = req.body;

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const updates = {};

            if (name !== undefined && typeof name === 'string') {
                const trimmed = name.trim();
                if (!trimmed) return res.status(400).json({ success: false, message: 'Name cannot be empty' });
                updates.name = trimmed;
            }

            if (email !== undefined && typeof email === 'string') {
                const trimmed = email.trim().toLowerCase();
                if (!trimmed) return res.status(400).json({ success: false, message: 'Email cannot be empty' });
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmed)) return res.status(400).json({ success: false, message: 'Invalid email format' });
                const existing = await User.findOne({ where: { email: trimmed } });
                if (existing && existing.id !== userId) {
                    return res.status(409).json({ success: false, message: 'A user with this email already exists' });
                }
                updates.email = trimmed;
            }

            if (newPassword !== undefined && newPassword !== null && String(newPassword).trim() !== '') {
                const newPwd = String(newPassword).trim();
                if (newPwd.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
                const current = currentPassword != null ? String(currentPassword) : '';
                const valid = await user.validatePassword(current);
                if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
                updates.password = newPwd;
            }

            if (avatar !== undefined) {
                if (avatar === null || avatar === '') {
                    updates.avatar = null;
                } else if (typeof avatar === 'string' && avatar.startsWith('data:image/')) {
                    const maxSize = 1024 * 1024; // 1MB
                    if (avatar.length > maxSize) {
                        return res.status(400).json({ success: false, message: 'Avatar image is too large. Use a smaller photo (max 1MB).' });
                    }
                    updates.avatar = avatar;
                } else {
                    return res.status(400).json({ success: false, message: 'Invalid avatar format. Please choose an image file.' });
                }
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ success: false, message: 'No valid updates provided' });
            }

            await user.update(updates);

            const updatedUser = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
            const safeUser = {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                userType: updatedUser.userType,
                avatar: updatedUser.avatar || null
            };

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: { user: safeUser }
            });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ success: false, message: 'A user with this email already exists' });
            }
            console.error('Update profile error:', error);
            res.status(500).json({ success: false, message: 'Error updating profile' });
        }
    },

    verifyEmail: async (req, res) => {
        try {
            const token = (req.query.token || req.body.token || '').trim();
            if (!token) {
                return res.status(400).json({ success: false, message: 'Verification token is required' });
            }

            const user = await User.findOne({
                where: {
                    emailVerificationToken: token,
                    emailVerificationTokenExpires: { [Op.gt]: new Date() }
                }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired verification link. You can request a new one from the login page. If you can already log in, your email may already be verified—you can ignore this message.'
                });
            }

            await user.update({
                isEmailVerified: true,
                emailVerificationToken: null,
                emailVerificationTokenExpires: null
            });

            res.json({
                success: true,
                message: 'Your email has been verified. You can now log in.'
            });
        } catch (error) {
            console.error('Verify email error:', error);
            res.status(500).json({ success: false, message: 'Verification failed' });
        }
    },

    resendVerification: async (req, res) => {
        try {
            const email = (req.body.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(400).json({ success: false, message: 'Email is required' });
            }

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'No account found with this email address.'
                });
            }

            if (user.isEmailVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'This account is already verified. You can log in.'
                });
            }

            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
            await user.update({
                emailVerificationToken: verificationToken,
                emailVerificationTokenExpires: verificationExpires
            });

            const emailResult = await sendVerificationEmail(user.email, user.name, verificationToken);
            if (!emailResult.sent && emailResult.error) {
                console.error('Resend verification: email send failed:', emailResult.error);
                const msg = process.env.NODE_ENV === 'development'
                    ? `Failed to send verification email: ${emailResult.error}. Check backend/.env SMTP settings and backend terminal for details.`
                    : 'Failed to send verification email. Please try again later.';
                return res.status(500).json({ success: false, message: msg });
            }

            res.json({
                success: true,
                message: 'Verification email sent. Please check your inbox.'
            });
        } catch (error) {
            console.error('Resend verification error:', error);
            const msg = process.env.NODE_ENV === 'development' && error.message
                ? `Failed to send verification email: ${error.message}`
                : 'Failed to send verification email. Please try again later.';
            return res.status(500).json({ success: false, message: msg });
        }
    },

    deleteAccount: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            if (user.userType === 'caregiver') {
                await user.setPatients([]);
            } else {
                const caregivers = await user.getCaregivers?.() || [];
                for (const c of caregivers) {
                    await c.removePatient?.(user);
                }
            }
            await user.destroy();
            res.json({
                success: true,
                message: 'Your account has been deleted.'
            });
        } catch (error) {
            console.error('Delete account error:', error);
            res.status(500).json({ success: false, message: 'Failed to delete account' });
        }
    }
};


module.exports = authController;