const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const activityController = require('../controllers/activityController');

// GET /api/activity/summary?patientId=all|<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', verifyToken, activityController.getActivitySummary);

module.exports = router;
