/**
 * Game controller – patients submit game session results.
 * POST /api/games – patient-only; creates GameSession for the logged-in patient.
 */
const { GameSession, User } = require('../models');
const { notifyCaregiversGameCompletion } = require('../utils/caregiverNotifications');

const gameController = {
    /**
     * POST /api/games
     * Body: { gameType, score, duration, accuracy? }
     * Patient-only: patientId = req.user.userId
     */
    createSession: async (req, res) => {
        try {
            if (req.user.userType !== 'patient') {
                return res.status(403).json({ success: false, message: 'Only patients can submit game sessions' });
            }

            const { gameType, score, duration, accuracy, maxScore, difficulty, effectiveDifficulty } = req.body;
            const allowedTypes = ['memory', 'math', 'sequencing'];

            if (!gameType || !allowedTypes.includes(String(gameType))) {
                return res.status(400).json({
                    success: false,
                    message: `gameType must be one of: ${allowedTypes.join(', ')}`,
                });
            }

            const scoreNum = parseInt(String(score), 10);
            const durationNum = parseInt(String(duration), 10);
            if (!Number.isFinite(scoreNum) || scoreNum < 0) {
                return res.status(400).json({ success: false, message: 'score must be a non-negative number' });
            }
            if (!Number.isFinite(durationNum) || durationNum < 0) {
                return res.status(400).json({ success: false, message: 'duration must be a non-negative number (seconds)' });
            }

            const accuracyVal = accuracy != null
                ? (parseFloat(String(accuracy)) || null)
                : null;
            if (accuracyVal != null && (accuracyVal < 0 || accuracyVal > 1)) {
                return res.status(400).json({ success: false, message: 'accuracy must be between 0 and 1 if provided' });
            }

            const maxScoreVal = maxScore != null ? parseInt(String(maxScore), 10) : null;
            const tierOk = (v) => v && ['easy', 'normal', 'hard'].includes(String(v).toLowerCase());
            const difficultyVal = tierOk(difficulty) ? String(difficulty).toLowerCase() : null;
            const effectiveVal = tierOk(effectiveDifficulty)
                ? String(effectiveDifficulty).toLowerCase()
                : difficultyVal;
            const difficultyForNotify =
                difficultyVal && effectiveVal && difficultyVal !== effectiveVal
                    ? `${difficultyVal}→${effectiveVal} (adaptive)`
                    : (effectiveVal || difficultyVal);

            const session = await GameSession.create({
                patientId: req.user.userId,
                gameType: String(gameType),
                score: scoreNum,
                duration: durationNum,
                accuracy: accuracyVal,
            });

            const patientUser = await User.findByPk(req.user.userId, { attributes: ['name'] });
            notifyCaregiversGameCompletion(
                req.user.userId,
                patientUser?.name,
                String(gameType),
                scoreNum,
                durationNum,
                maxScoreVal,
                difficultyForNotify
            ).catch((err) => console.error('Caregiver game completion email error:', err));

            return res.status(201).json({
                success: true,
                data: {
                    id: session.id,
                    gameType: session.gameType,
                    score: session.score,
                    duration: session.duration,
                    accuracy: session.accuracy,
                    playedAt: session.playedAt,
                },
            });
        } catch (error) {
            console.error('Create game session error:', error);
            return res.status(500).json({ success: false, message: 'Error saving game session' });
        }
    },
};

module.exports = gameController;
