/**
 * Auth middleware – verifies JWT from Authorization: Bearer <token> and attaches req.user (userId, userType).
 * Used by all protected routes; returns 401 if missing or invalid.
 */
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Add user info to request
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// Added token refresh to be implemented later if there's time (optional task that is a could requirement)
const refreshToken = (req, res, next) => {
    // Check if token is about to expire (e.g., within 1 hour)
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
        try {
            const decoded = jwt.decode(token);
            const now = Date.now() / 1000;
            const expiresIn = decoded.exp - now;

            // If token expires in less than 1 hour, set flag to refresh
            if (expiresIn < 3600) {
                req.shouldRefreshToken = true;
            }
        } catch (error) {
            // Ignore decoding errors
        }
    }
    next();
};

module.exports = { verifyToken };