/**
 * Role middleware – restrict routes by userType (caregiver | patient).
 * Must run after verifyToken so req.user is set. Used by patient and auth routes.
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.userType)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

// Specific role checkers
const requireCaregiver = checkRole(['caregiver']);
const requirePatient = checkRole(['patient']);
const requireAny = checkRole(['caregiver', 'patient']);

module.exports = {
    checkRole,
    requireCaregiver,
    requirePatient,
    requireAny
};