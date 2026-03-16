/**
 * Activity routes – mounted at /api/activity. Summary and log for reminder adherence;
 * caregiver-only, with patient assignment checks in controller.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const activityController = require('../controllers/activityController');

router.get('/summary', verifyToken, activityController.getActivitySummary);
// GET /api/activity/log?patientId=all|<id>&type=all|medication|appointment|general&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=25
router.get("/log", verifyToken, activityController.getActivityLog);
// GET /api/activity/games-today — count of game sessions today for caregiver's patients
router.get("/games-today", verifyToken, activityController.getGamesPlayedToday);
// GET /api/activity/patient-summaries?patientId=optional — per-patient activity summary for today
router.get("/patient-summaries", verifyToken, activityController.getPatientSummaries);
// GET /api/activity/games-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&patientId=all|<id> — chart-ready game session aggregates
router.get("/games-summary", verifyToken, activityController.getGamesSummary);
// GET /api/activity/recent-games?limit=20 — recent game sessions for dashboard activity feed
router.get("/recent-games", verifyToken, activityController.getRecentGameSessions);
module.exports = router;
