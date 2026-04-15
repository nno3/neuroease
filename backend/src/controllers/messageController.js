/**
 * Message controller – send, list conversation, mark read, respond to meeting requests.
 * Caregivers can message their assigned patients; patients can message their caregiver.
 */
const { Message, User, Patient, Reminder, PushSubscription } = require('../models');
const { Op } = require('sequelize');
const { sendMeetingAcceptedEmails, sendNewMessageEmail } = require('../utils/emailService');
const { sendPush } = require('../utils/pushService');
const { parsePrefs } = require('../utils/caregiverNotifications');

/** Minimal user fields to attach to each message */
const USER_ATTRS = ['id', 'name', 'userType'];

/**
 * Verify the requesting user is allowed to message the other party:
 * - caregiver → patient: patient must be assigned to this caregiver
 * - patient → caregiver: caregiver must be assigned to this patient
 */
async function canMessage(requestingUser, otherUserId) {
    const other = await User.findByPk(otherUserId, { attributes: USER_ATTRS });
    if (!other) return false;

    if (requestingUser.userType === 'caregiver') {
        if (other.userType !== 'patient') return false;
        const caregiver = await User.findByPk(requestingUser.userId);
        const patients = await caregiver.getPatients();
        return patients.some((p) => p.id === otherUserId);
    }

    if (requestingUser.userType === 'patient') {
        if (other.userType !== 'caregiver') return false;
        const patientUser = await User.findByPk(requestingUser.userId);
        if (!patientUser) return false;
        const caregivers = await patientUser.getCaregivers();
        return caregivers.some((c) => c.id === otherUserId);
    }

    return false;
}

/** POST /api/messages — send a message or meeting request */
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const { receiverId, content, type, meetingTime } = req.body;

        if (!receiverId || !content?.trim()) {
            return res.status(400).json({ success: false, message: 'receiverId and content are required' });
        }
        if (type === 'meeting_request' && !meetingTime) {
            return res.status(400).json({ success: false, message: 'meetingTime is required for meeting requests' });
        }

        const allowed = await canMessage(req.user, receiverId);
        if (!allowed) {
            return res.status(403).json({ success: false, message: 'Not authorised to message this user' });
        }

        const message = await Message.create({
            senderId,
            receiverId,
            content: content.trim(),
            type: type === 'meeting_request' ? 'meeting_request' : 'message',
            meetingTime: type === 'meeting_request' ? meetingTime : null,
            meetingStatus: type === 'meeting_request' ? 'pending' : null,
        });

        const sender = await User.findByPk(senderId, { attributes: USER_ATTRS });
        const payload = { ...message.toJSON(), sender };

        // Emit to receiver's socket room if they are online
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${receiverId}`).emit('new_message', payload);
        }

        // Notifications to receiver
        const receiver = await User.findByPk(receiverId, {
            attributes: ['id', 'name', 'email', 'userType', 'emailNotificationPreferences'],
        });

        const pushTitle = `New message from ${sender?.name || 'NeuroEase'}`;
        const pushBody = message.type === 'meeting_request'
            ? `📅 Meeting request: ${message.content?.slice(0, 60)}`
            : message.content?.slice(0, 80);

        if (receiver?.userType === 'caregiver') {
            // Caregiver: always send push if subscribed; email if they opted in
            const receiverSubs = await PushSubscription.findAll({ where: { userId: receiverId } });
            if (receiverSubs.length > 0) {
                await Promise.allSettled(receiverSubs.map((sub) => sendPush(sub, { title: pushTitle, body: pushBody })));
            }
            if (receiver.email && parsePrefs(receiver.emailNotificationPreferences).messages) {
                const appUrl = process.env.FRONTEND_URL || '';
                sendNewMessageEmail(receiver.email, receiver.name, sender?.name, message.type === 'meeting_request', appUrl)
                    .catch((err) => console.error('New-message email error:', err.message));
            }
        } else if (receiver?.userType === 'patient') {
            // Patient: check messageNotifications opt-in, then use their chosen channel
            const patientProfile = await Patient.findOne({
                where: { userId: receiverId },
                attributes: ['messageNotifications', 'reminderNotificationChannel'],
            });
            if (patientProfile?.messageNotifications) {
                const ch = patientProfile.reminderNotificationChannel || 'none';
                if (ch === 'push') {
                    const receiverSubs = await PushSubscription.findAll({ where: { userId: receiverId } });
                    if (receiverSubs.length > 0) {
                        await Promise.allSettled(receiverSubs.map((sub) => sendPush(sub, { title: pushTitle, body: pushBody })));
                    }
                } else if (ch === 'email' && receiver.email) {
                    const appUrl = process.env.FRONTEND_URL || '';
                    sendNewMessageEmail(receiver.email, receiver.name, sender?.name, message.type === 'meeting_request', appUrl)
                        .catch((err) => console.error('New-message email error:', err.message));
                }
            }
        }

        res.status(201).json({ success: true, data: payload });
    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};

/** GET /api/messages/conversation/:otherUserId — full conversation history */
const getConversation = async (req, res) => {
    try {
        const myId = req.user.userId;
        const otherId = parseInt(req.params.otherUserId, 10);

        const allowed = await canMessage(req.user, otherId);
        if (!allowed) {
            return res.status(403).json({ success: false, message: 'Not authorised' });
        }

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { senderId: myId, receiverId: otherId },
                    { senderId: otherId, receiverId: myId },
                ],
            },
            include: [
                { model: User, as: 'sender', attributes: USER_ATTRS },
                { model: User, as: 'receiver', attributes: USER_ATTRS },
            ],
            order: [['createdAt', 'ASC']],
        });

        // Mark all unread messages sent to me as read
        const [updatedCount] = await Message.update(
            { isRead: true },
            { where: { senderId: otherId, receiverId: myId, isRead: false } }
        );

        // Tell the other person their messages were seen
        if (updatedCount > 0) {
            const io = req.app.get('io');
            if (io) {
                io.to(`user:${otherId}`).emit('messages_read', { byUserId: myId });
            }
        }

        res.json({ success: true, data: messages });
    } catch (err) {
        console.error('getConversation error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
    }
};

/** GET /api/messages/contacts — list all people I can message, with last message + unread count */
const getContacts = async (req, res) => {
    try {
        const myId = req.user.userId;
        let contactIds = [];

        if (req.user.userType === 'caregiver') {
            const caregiver = await User.findByPk(myId);
            const patients = await caregiver.getPatients();
            contactIds = patients.map((p) => p.id);
        } else {
            const patientUser = await User.findByPk(myId);
            if (patientUser) {
                const caregivers = await patientUser.getCaregivers();
                contactIds = caregivers.map((c) => c.id);
            }
        }

        const contacts = await Promise.all(
            contactIds.map(async (contactId) => {
                const user = await User.findByPk(contactId, { attributes: USER_ATTRS });
                const lastMessage = await Message.findOne({
                    where: {
                        [Op.or]: [
                            { senderId: myId, receiverId: contactId },
                            { senderId: contactId, receiverId: myId },
                        ],
                    },
                    order: [['createdAt', 'DESC']],
                });
                const unreadCount = await Message.count({
                    where: { senderId: contactId, receiverId: myId, isRead: false },
                });
                return { user, lastMessage, unreadCount };
            })
        );

        res.json({ success: true, data: contacts });
    } catch (err) {
        console.error('getContacts error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
    }
};

/** PATCH /api/messages/:id/meeting — accept or decline a meeting request */
const respondToMeeting = async (req, res) => {
    try {
        const myId = req.user.userId;
        const { status } = req.body; // 'accepted' | 'declined'

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ success: false, message: "status must be 'accepted' or 'declined'" });
        }

        const message = await Message.findByPk(req.params.id);
        if (!message || message.type !== 'meeting_request') {
            return res.status(404).json({ success: false, message: 'Meeting request not found' });
        }
        if (message.receiverId !== myId) {
            return res.status(403).json({ success: false, message: 'Not authorised' });
        }

        await message.update({ meetingStatus: status });

        // Notify sender via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${message.senderId}`).emit('meeting_response', {
                messageId: message.id,
                status,
                respondedBy: myId,
            });
        }

        // On decline: push + email to the person who made the request
        if (status === 'declined') {
            const decliner = await User.findByPk(message.receiverId, { attributes: ['id', 'name'] });
            const senderSubs = await PushSubscription.findAll({ where: { userId: message.senderId } });
            if (senderSubs.length > 0) {
                await Promise.allSettled(senderSubs.map((sub) => sendPush(sub, {
                    title: 'Meeting request declined',
                    body: `${decliner?.name || 'Your contact'} declined your meeting request.`,
                })));
            }
            const senderUser = await User.findByPk(message.senderId, { attributes: ['id', 'name', 'email', 'emailNotificationPreferences'] });
            if (senderUser?.email) {
                const prefs = parsePrefs(senderUser.emailNotificationPreferences);
                if (prefs.messages) {
                    const appUrl = process.env.FRONTEND_URL || '';
                    sendNewMessageEmail(
                        senderUser.email,
                        senderUser.name,
                        decliner?.name,
                        false,
                        appUrl,
                        {
                            subject: `${decliner?.name || 'Your contact'} declined your meeting request`,
                            bodyLine: `<strong>${decliner?.name || 'Your contact'}</strong> has declined your meeting request.`,
                        }
                    ).catch((err) => console.error('Decline email error:', err.message));
                }
            }
        }

        // On acceptance: create reminders for both parties + send push + email
        if (status === 'accepted' && message.meetingTime) {
            const sender = await User.findByPk(message.senderId, { attributes: ['id', 'name', 'email', 'userType'] });
            const receiver = await User.findByPk(message.receiverId, { attributes: ['id', 'name', 'email', 'userType'] });

            // Determine who is caregiver and who is patient
            const caregiver = sender?.userType === 'caregiver' ? sender : receiver;
            const patient = sender?.userType === 'patient' ? sender : receiver;

            const meetingTitle = `Meeting with ${caregiver?.name || 'caregiver'}`;
            const patientMeetingTitle = `Meeting with ${caregiver?.name || 'your caregiver'}`;
            const noteContent = message.content;

            // Create reminder for patient (shows in their Reminders page)
            if (patient) {
                await Reminder.create({
                    patientId: patient.id,
                    title: patientMeetingTitle,
                    message: noteContent,
                    reminderType: 'appointment',
                    scheduledTime: message.meetingTime,
                    recurrence: 'once',
                }).catch((err) => console.error('Failed to create patient meeting reminder:', err.message));
            }

            // Create reminder for caregiver (shows in their calendar)
            // Caregivers are users too — store as a reminder linked to the patient
            if (caregiver && patient) {
                await Reminder.create({
                    patientId: patient.id,
                    title: meetingTitle,
                    message: noteContent,
                    reminderType: 'appointment',
                    scheduledTime: message.meetingTime,
                    recurrence: 'once',
                }).catch((err) => console.error('Failed to create caregiver meeting reminder:', err.message));
            }

            // Push notification to sender (the one who made the request)
            const senderSubs = await PushSubscription.findAll({ where: { userId: message.senderId } });
            const pushPayload = {
                title: 'Meeting accepted ✓',
                body: `${receiver?.name || 'Your contact'} accepted the meeting on ${new Date(message.meetingTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            };
            await Promise.allSettled(senderSubs.map((sub) => sendPush(sub, pushPayload)));

            // Push notification to receiver (the one who accepted)
            const receiverSubs = await PushSubscription.findAll({ where: { userId: message.receiverId } });
            const receiverPushPayload = {
                title: 'Meeting confirmed ✓',
                body: `Meeting with ${sender?.name || 'your contact'} on ${new Date(message.meetingTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            };
            await Promise.allSettled(receiverSubs.map((sub) => sendPush(sub, receiverPushPayload)));

            // Email both parties (non-blocking)
            sendMeetingAcceptedEmails({
                caregiverEmail: caregiver?.email,
                caregiverName: caregiver?.name,
                patientEmail: patient?.email,
                patientName: patient?.name,
                meetingTime: message.meetingTime,
                note: noteContent,
            }).catch((err) => console.error('Meeting email error:', err.message));
        }

        res.json({ success: true, data: message });
    } catch (err) {
        console.error('respondToMeeting error:', err);
        res.status(500).json({ success: false, message: 'Failed to update meeting request' });
    }
};

/** DELETE /api/messages/:id/meeting — cancel an accepted meeting request */
const cancelMeeting = async (req, res) => {
    try {
        const myId = req.user.userId;
        const message = await Message.findByPk(req.params.id);

        if (!message || message.type !== 'meeting_request') {
            return res.status(404).json({ success: false, message: 'Meeting request not found' });
        }
        if (message.senderId !== myId && message.receiverId !== myId) {
            return res.status(403).json({ success: false, message: 'Not authorised' });
        }
        if (message.meetingStatus !== 'accepted') {
            return res.status(400).json({ success: false, message: 'Only accepted meetings can be cancelled' });
        }

        await message.update({ meetingStatus: 'declined' });

        // Notify the other party via socket
        const otherId = message.senderId === myId ? message.receiverId : message.senderId;
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${otherId}`).emit('meeting_response', {
                messageId: message.id,
                status: 'declined',
                respondedBy: myId,
                cancelled: true,
            });
        }

        // Push notification to the other party
        const canceller = await User.findByPk(myId, { attributes: ['id', 'name'] });
        const otherSubs = await PushSubscription.findAll({ where: { userId: otherId } });
        if (otherSubs.length > 0) {
            await Promise.allSettled(otherSubs.map((sub) => sendPush(sub, {
                title: 'Meeting cancelled',
                body: `${canceller?.name || 'Your contact'} cancelled the meeting.`,
            })));
        }

        res.json({ success: true, data: message });
    } catch (err) {
        console.error('cancelMeeting error:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel meeting' });
    }
};

/** GET /api/messages/unread-count — total unread messages for badge */
const getUnreadCount = async (req, res) => {
    try {
        const count = await Message.count({
            where: { receiverId: req.user.userId, isRead: false },
        });
        res.json({ success: true, data: { count } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
};

module.exports = { sendMessage, getConversation, getContacts, respondToMeeting, cancelMeeting, getUnreadCount };
