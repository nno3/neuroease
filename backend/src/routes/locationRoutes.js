const express = require('express');
const locationController = require('../controllers/locationController');
const { verifyToken } = require('../middleware/auth');
const { requireCaregiver } = require('../middleware/roles');

const router = express.Router();

router.use(verifyToken);
router.use(requireCaregiver);

router.post('/update', locationController.update);
router.get('/latest', locationController.latest);

module.exports = router;
