/**
 * Location controller – store updates, run geofence checks, return latest position and alerts.
 * On each update we load the patient's safe zones and previous location; if they were inside
 * a zone and are now outside we create a "left" alert; if they were outside and re-enter we
 * can record return. Distance is Haversine (meters). patientId in all APIs is the patient's
 * User id (users.id), not the Patient profile id.
 */
const { Op } = require('sequelize');
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

            // Geofence: compare previous position vs current against safe zones to detect leave/return
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

            // Transition: inside -> outside = "left safe zone" alert; outside -> inside = return (for UI)
            if (previousInside && !currentInside) {
                await LocationAlert.create({
                    patientId: pid,
                    latitude: lat,
                    longitude: lng,
                    timestamp: ts,
                    message: 'Left safe zone',
                });
            }
            // If patient was outside and is now inside, record return (for caregiver visibility)
            if (!previousInside && currentInside && previousLog) {
                await LocationAlert.create({
                    patientId: pid,
                    latitude: lat,
                    longitude: lng,
                    timestamp: ts,
                    message: 'Returned to safe zone',
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
     * POST /api/location/patient/update
     * Patient-only: body { latitude, longitude, timestamp?, accuracy? }.
     * Uses req.user.userId as patientId. Requires locationConsent.
     */
    patientUpdate: async (req, res) => {
        try {
            const pid = req.user.userId;
            const { latitude, longitude, timestamp, accuracy } = req.body;

            const lat = Number(latitude);
            const lng = Number(longitude);
            if (latitude == null || longitude == null || Number.isNaN(lat) || Number.isNaN(lng)) {
                return res.status(400).json({
                    success: false,
                    message: 'latitude and longitude are required and must be valid numbers',
                });
            }

            const hasConsent = await getLocationConsent(pid);
            if (!hasConsent) {
                return res.status(403).json({
                    success: false,
                    message: 'Location sharing is not enabled. Enable it in Profile to share your location.',
                });
            }

            const ts = timestamp ? new Date(timestamp) : new Date();
            if (Number.isNaN(ts.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid timestamp',
                });
            }

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

            const logData = {
                patientId: pid,
                latitude: lat,
                longitude: lng,
                timestamp: ts,
            };
            if (accuracy != null && !Number.isNaN(Number(accuracy))) {
                logData.accuracy = Number(accuracy);
            }
            const log = await LocationLog.create(logData);

            if (previousInside && !currentInside) {
                await LocationAlert.create({
                    patientId: pid,
                    latitude: lat,
                    longitude: lng,
                    timestamp: ts,
                    message: 'Left safe zone',
                });
            }
            if (!previousInside && currentInside && previousLog) {
                await LocationAlert.create({
                    patientId: pid,
                    latitude: lat,
                    longitude: lng,
                    timestamp: ts,
                    message: 'Returned to safe zone',
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
            console.error('Location patient update error:', err);
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
     * If patientId present: alerts for that patient only.
     * If patientId omitted: recent alerts for all of the caregiver's patients (last 7 days), with patient name.
     */
    alerts: async (req, res) => {
        try {
            const patientIdParam =
                req.query.patientId != null ? parseInt(req.query.patientId, 10) : NaN;

            if (!Number.isNaN(patientIdParam)) {
                const check = await ensurePatientAssigned(req, patientIdParam);
                if (!check.allowed) {
                    return res.status(403).json({ success: false, message: check.message });
                }
                const patientUser = await User.findByPk(patientIdParam, { attributes: ['id', 'isArchived'] });
                if (patientUser && patientUser.isArchived) {
                    return res.json({ success: true, data: [] });
                }
                const list = await LocationAlert.findAll({
                    where: { patientId: patientIdParam },
                    order: [['timestamp', 'DESC']],
                });
                return res.json({ success: true, data: list });
            }

            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) {
                return res.status(404).json({ success: false, message: 'Caregiver not found' });
            }
            const assigned = await caregiver.getPatients();
            const assignedIds = assigned.filter((p) => !p.isArchived).map((p) => p.id);
            if (assignedIds.length === 0) {
                return res.json({ success: true, data: [] });
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const list = await LocationAlert.findAll({
                where: {
                    patientId: { [Op.in]: assignedIds },
                    timestamp: { [Op.gte]: sevenDaysAgo },
                },
                include: [{ model: User, as: 'patient', attributes: ['id', 'name'] }],
                order: [['timestamp', 'DESC']],
                limit: 50,
            });

            const data = list.map((a) => ({
                id: a.id,
                patientId: a.patientId,
                patientName: a.patient?.name ?? `Patient ${a.patientId}`,
                latitude: a.latitude,
                longitude: a.longitude,
                timestamp: a.timestamp,
                message: a.message,
            }));

            return res.json({ success: true, data });
        } catch (err) {
            console.error('Location alerts error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve location alerts',
            });
        }
    },

    /**
     * GET /api/location/status
     * For dashboard: returns both recent breach alerts and patients currently outside any safe zone.
     */
    status: async (req, res) => {
        try {
            const caregiver = await User.findByPk(req.user.userId);
            if (!caregiver) {
                return res.status(404).json({ success: false, message: 'Caregiver not found' });
            }
            const assigned = await caregiver.getPatients();
            const activePatients = assigned.filter((p) => !p.isArchived);
            const assignedIds = activePatients.map((p) => p.id);
            if (assignedIds.length === 0) {
                return res.json({ success: true, data: { alerts: [], currentlyOutside: [] } });
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [alertRows, patientProfiles] = await Promise.all([
                LocationAlert.findAll({
                    where: {
                        patientId: { [Op.in]: assignedIds },
                        timestamp: { [Op.gte]: sevenDaysAgo },
                    },
                    include: [{ model: User, as: 'patient', attributes: ['id', 'name'] }],
                    order: [['timestamp', 'DESC']],
                    limit: 50,
                }),
                Patient.findAll({ where: { userId: { [Op.in]: assignedIds } } }),
            ]);

            const alerts = alertRows.map((a) => ({
                id: a.id,
                patientId: a.patientId,
                patientName: a.patient?.name ?? `Patient ${a.patientId}`,
                latitude: a.latitude,
                longitude: a.longitude,
                timestamp: a.timestamp,
                message: a.message,
            }));

            const consentUserIds = new Set(
                patientProfiles.filter((p) => p.locationConsent).map((p) => p.userId)
            );

            const currentlyOutside = [];
            for (const uid of consentUserIds) {
                const [latestLog, zones] = await Promise.all([
                    LocationLog.findOne({
                        where: { patientId: uid },
                        order: [['timestamp', 'DESC']],
                    }),
                    SafeZone.findAll({ where: { patientId: uid, isActive: true } }),
                ]);
                if (!latestLog || zones.length === 0) continue;
                const lat = Number(latestLog.latitude);
                const lng = Number(latestLog.longitude);
                const insideAny = zones.some((z) => {
                    const dist = haversineMeters(lat, lng, Number(z.centerLat), Number(z.centerLng));
                    return dist <= Number(z.radius);
                });
                if (!insideAny) {
                    const patientUser = activePatients.find((p) => p.id === uid);
                    currentlyOutside.push({
                        patientId: uid,
                        patientName: patientUser?.name ?? `Patient ${uid}`,
                        timestamp: latestLog.timestamp,
                    });
                }
            }

            return res.json({
                success: true,
                data: { alerts, currentlyOutside },
            });
        } catch (err) {
            console.error('Location status error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve location status',
            });
        }
    },
};

module.exports = locationController;
