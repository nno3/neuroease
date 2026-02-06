const { User, Patient, LocationLog, SafeZone, LocationAlert } = require('../models');

/** Distance in meters between two (lat, lng) points (Haversine). */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** True if (lat, lng) is inside the zone (distance <= radius in meters). */
function isInsideZone(lat, lng, zone) {
    const dist = haversineMeters(lat, lng, zone.centerLat, zone.centerLng);
    return dist <= zone.radius;
}

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

/**
 * In all location APIs, patientId is the patient's USER id (users.id), not the
 * Patient profile table id (patients.id). The dashboard patient list uses the
 * same id: each item's top-level "id" is the user id to pass as patientId.
 */
const locationController = {
    /**
     * POST /api/location/update
     * Body: { patientId, latitude, longitude, timestamp }
     * patientId = patient's User id (users.id). Stores in location_logs.
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

            // Geofence: load active safe zones and previous location to detect exit
            const zones = await SafeZone.findAll({
                where: { patientId: pid, isActive: true },
            });
            const previousLog = await LocationLog.findOne({
                where: { patientId: pid },
                order: [['timestamp', 'DESC']],
            });
            const previousInside =
                zones.length > 0 &&
                previousLog &&
                zones.some((z) => isInsideZone(previousLog.latitude, previousLog.longitude, z));
            const currentInside =
                zones.length > 0 && zones.some((z) => isInsideZone(lat, lng, z));

            const log = await LocationLog.create({
                patientId: pid,
                latitude: lat,
                longitude: lng,
                timestamp: ts,
            });

            // If patient was inside a zone and is now outside, create one alert (avoid duplicate for same breach)
            if (previousInside && !currentInside) {
                await LocationAlert.create({
                    patientId: pid,
                    latitude: lat,
                    longitude: lng,
                    timestamp: ts,
                    message: 'Left safe zone',
                });
            }

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
     * patientId = patient's User id. Returns the most recent location; 404 if none.
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
                return res.status(404).json({
                    success: false,
                    message: 'No location data available for this patient.',
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

    /**
     * GET /api/location/alerts?patientId=
     * patientId = patient's User id. Returns location alerts (safe-zone breaches).
     */
    alerts: async (req, res) => {
        try {
            const patientId =
                req.query.patientId != null ? parseInt(req.query.patientId, 10) : NaN;
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
            const list = await LocationAlert.findAll({
                where: { patientId },
                order: [['timestamp', 'DESC']],
            });
            return res.json({ success: true, data: list });
        } catch (err) {
            console.error('Location alerts error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve location alerts',
            });
        }
    },
};

module.exports = locationController;
