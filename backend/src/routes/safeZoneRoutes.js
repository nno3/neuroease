/**
 * Safe zone routes – mounted at /api/safe-zones. CRUD for geofence zones per patient; caregiver-only.
 */
const express = require('express');
const safeZoneController = require('../controllers/safeZoneController');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver } = require('../middleware/roles');

const router = express.Router();

router.use(verifyToken);
router.use(requireCaregiver);

router.post('/', safeZoneController.create);
router.get('/', safeZoneController.list);
router.put('/:id', safeZoneController.update);
router.delete('/:id', safeZoneController.delete);

module.exports = router;
