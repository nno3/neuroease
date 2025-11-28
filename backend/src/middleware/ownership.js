const { User } = require('../models/User');

const canAccessPatientData = async (req, res, next) => {
    try {
        const requestingUser = await User.findByPk(req.user.userId);

        if (req.user.userType === 'patient') {
            // Patients can only access their own data
            if (req.user.userId !== parseInt(req.params.patientId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to patient data'
                });
            }
        } else if (req.user.userType === 'caregiver') {
            // Caregivers can only access assigned patients
            const assignedPatients = await requestingUser.getPatients();
            const patientIds = assignedPatients.map(p => p.id);

            if (!patientIds.includes(parseInt(req.params.patientId))) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Patient not assigned to you.'
                });
            }
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking access permissions'
        });
    }
};

module.exports = { canAccessPatientData };