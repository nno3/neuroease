/**
 * Message routes – mounted at /api/messages.
 * All routes require a valid JWT. Ownership enforced in controller.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requireAny } = require('../middleware/roles');
const {
    sendMessage,
    getConversation,
    getContacts,
    respondToMeeting,
    cancelMeeting,
    getUnreadCount,
} = require('../controllers/messageController');

router.use(verifyToken, requireAny);

router.get('/contacts', getContacts);
router.get('/unread-count', getUnreadCount);
router.get('/conversation/:otherUserId', getConversation);
router.post('/', sendMessage);
router.patch('/:id/meeting', respondToMeeting);
router.delete('/:id/meeting', cancelMeeting);

module.exports = router;
