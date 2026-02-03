const { User, Patient, LocationLog } = require('../models');

/**
 * Ensure the authenticated caregiver is assigned to the given patient (by patient User id).
 * Sets req.assignedPatientIds when valid.
 */
async function ensurePatientAssigned(req, patientId) {
    const caregiver = await User.findByPk(req.user.userId);
    if (!caregiver) return { allowed: false, message: 'Caregiver not found' };
    const assigned = await caregiver.getPatients();
    const assignedIds = assigned.map((p) => p.id);
    if (!assignedIds.includes(patientId)) {
        return { allowed: false, message: 'Access denied. Patient not assigned to you.' };
    }
    return { allowed: true, assignedIds };
}

/**
 * Get location consent for a patient (by patient User id). Consent is on the Patient profile.
 */
async function getLocationConsent(patientUserId) {
    const profile = await Patient.findOne({ where: { userId: patientUserId } });
    return profile ? Boolean(profile.locationConsent) : false;
}

const locationController = {
    /**
     * POST /api/location/update
     * Body: { patientId, latitude, longitude, timestamp }
     * Stores in location_logs. Validates caregiver–patient relationship and location consent.
     */
    update: async (req, res) => {
        try {
            const { patientId, latitude, longitude, timestamp } = req.body;
            const pid = patientId != null ? parseInt(patientId, 10) : NaN;

            if (Number.isNaN(pid)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or missing patientId',
                });
            }
            const lat = Number(latitude);
            const lng = Number(longitude);
            if (latitude == null || longitude == null || Number.isNaN(lat) || Number.isNaN(lng)) {
                return res.status(400).json({
                    success: false,
                    message: 'latitude and longitude are required and must be valid numbers',
                });
            }

            const check = await ensurePatientAssigned(req, pid);
            if (!check.allowed) {
                return res.status(403).json({ success: false, message: check.message });
            }

            const hasConsent = await getLocationConsent(pid);
            if (!hasConsent) {
                return res.status(403).json({
                    success: false,
                    message: 'Location sharing is not enabled for this patient.',
                });
            }

            const ts = timestamp ? new Date(timestamp) : new Date();
            if (Number.isNaN(ts.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid timestamp',
                });
            }

            const log = await LocationLog.create({
                patientId: pid,
                latitude: lat,
                longitude: lng,
                timestamp: ts,
            });

            return res.status(201).json({
                success: true,
                message: 'Location updated',
                data: {
                    id: log.id,
                    patientId: log.patientId,
                    latitude: log.latitude,
                    longitude: log.longitude,
                    timestamp: log.timestamp,
                },
            });
        } catch (err) {
            console.error('Location update error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to update location',
            });
        }
    },

    /**
     * GET /api/location/latest?patientId=
     * Returns the most recent valid location for the patient. 404 if none.
     */
    latest: async (req, res) => {
        try {
            const patientId = req.query.patientId != null ? parseInt(req.query.patientId, 10) : NaN;

            if (Number.isNaN(patientId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing or invalid patientId query parameter',
                });
            }

            const check = await ensurePatientAssigned(req, patientId);
            if (!check.allowed) {
                return res.status(403).json({ success: false, message: check.message });
            }

            const hasConsent = await getLocationConsent(patientId);
            if (!hasConsent) {
                return res.status(403).json({
                    success: false,
                    message: 'Location sharing is not enabled for this patient.',
                });
            }

            const log = await LocationLog.findOne({
                where: { patientId },
                order: [['timestamp', 'DESC']],
            });

            if (!log) {
                return res.status(404).json({
                    success: false,
                    message: 'No location data found for this patient.',
                });
            }

            return res.json({
                success: true,
                data: {
                    patientId: log.patientId,
                    latitude: log.latitude,
                    longitude: log.longitude,
                    timestamp: log.timestamp,
                },
            });
        } catch (err) {
            console.error('Location latest error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve location',
            });
        }
    },
};

module.exports = locationController;
