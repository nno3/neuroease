const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const activityController = require('../controllers/activityController');

// GET /api/activity/summary?patientId=all|<id>&type=all|medication|appointment|general&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', verifyToken, activityController.getActivitySummary);
//GET /api/activity/log?patientId=all|<id>&type=all|medication|appointment|general&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=25
router.get("/log", verifyToken, activityController.getActivityLog);
module.exports = router;
