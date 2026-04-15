const { User, SafeZone } = require('../models');

async function ensurePatientAssigned(req, patientId) {
    const caregiver = await User.findByPk(req.user.userId);
    if (!caregiver) return { allowed: false, message: 'Caregiver not found' };
    const assigned = await caregiver.getPatients();
    const assignedIds = assigned.map((p) => p.id);
    if (!assignedIds.includes(patientId)) {
        return { allowed: false, message: 'Access denied. Patient not assigned to you.' };
    }
    return { allowed: true };
}

const safeZoneController = {
    /** POST /api/safe-zones — body: { patientId, name, centerLat, centerLng, radius? } */
    create: async (req, res) => {
        try {
            const { patientId, name, centerLat, centerLng, radius } = req.body;
            const pid = patientId != null ? parseInt(patientId, 10) : NaN;
            if (Number.isNaN(pid)) {
                return res.status(400).json({ success: false, message: 'Invalid or missing patientId' });
            }
            const check = await ensurePatientAssigned(req, pid);
            if (!check.allowed) {
                return res.status(403).json({ success: false, message: check.message });
            }
            const lat = Number(centerLat);
            const lng = Number(centerLng);
            if (centerLat == null || centerLng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
                return res.status(400).json({
                    success: false,
                    message: 'centerLat and centerLng are required and must be valid numbers',
                });
            }
            const rad = radius != null ? parseInt(radius, 10) : 100;
            if (Number.isNaN(rad) || rad < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'radius must be at least 10 m (GPS accuracy limit for reliable geofencing)',
                });
            }
            const zone = await SafeZone.create({
                patientId: pid,
                name: (name != null && String(name).trim()) ? String(name).trim() : 'Safe Zone',
                centerLat: lat,
                centerLng: lng,
                radius: rad,
            });
            return res.status(201).json({
                success: true,
                message: 'Safe zone created',
                data: zone,
            });
        } catch (err) {
            console.error('Safe zone create error:', err);
            return res.status(500).json({ success: false, message: 'Failed to create safe zone' });
        }
    },

    /** GET /api/safe-zones?patientId= */
    list: async (req, res) => {
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
            const zones = await SafeZone.findAll({
                where: { patientId },
                order: [['id', 'ASC']],
            });
            return res.json({ success: true, data: zones });
        } catch (err) {
            console.error('Safe zone list error:', err);
            return res.status(500).json({ success: false, message: 'Failed to list safe zones' });
        }
    },

    /** PUT /api/safe-zones/:id — body: { name?, centerLat?, centerLng?, radius? } */
    update: async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) {
                return res.status(400).json({ success: false, message: 'Invalid zone id' });
            }
            const zone = await SafeZone.findByPk(id);
            if (!zone) {
                return res.status(404).json({ success: false, message: 'Safe zone not found' });
            }
            const check = await ensurePatientAssigned(req, zone.patientId);
            if (!check.allowed) {
                return res.status(403).json({ success: false, message: check.message });
            }
            const { name, centerLat, centerLng, radius } = req.body;
            if (name !== undefined) zone.name = String(name).trim() || zone.name;
            if (centerLat != null) {
                const lat = Number(centerLat);
                if (Number.isNaN(lat)) {
                    return res.status(400).json({ success: false, message: 'centerLat must be a valid number' });
                }
                zone.centerLat = lat;
            }
            if (centerLng != null) {
                const lng = Number(centerLng);
                if (Number.isNaN(lng)) {
                    return res.status(400).json({ success: false, message: 'centerLng must be a valid number' });
                }
                zone.centerLng = lng;
            }
            if (radius != null) {
                const rad = parseInt(radius, 10);
                if (Number.isNaN(rad) || rad < 10) {
                    return res.status(400).json({ success: false, message: 'radius must be at least 10 m (GPS accuracy limit for reliable geofencing)' });
                }
                zone.radius = rad;
            }
            await zone.save();
            return res.json({ success: true, message: 'Safe zone updated', data: zone });
        } catch (err) {
            console.error('Safe zone update error:', err);
            return res.status(500).json({ success: false, message: 'Failed to update safe zone' });
        }
    },

    /** DELETE /api/safe-zones/:id */
    delete: async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) {
                return res.status(400).json({ success: false, message: 'Invalid zone id' });
            }
            const zone = await SafeZone.findByPk(id);
            if (!zone) {
                return res.status(404).json({ success: false, message: 'Safe zone not found' });
            }
            const check = await ensurePatientAssigned(req, zone.patientId);
            if (!check.allowed) {
                return res.status(403).json({ success: false, message: check.message });
            }
            await zone.destroy();
            return res.json({ success: true, message: 'Safe zone deleted' });
        } catch (err) {
            console.error('Safe zone delete error:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete safe zone' });
        }
    },
};

module.exports = safeZoneController;
