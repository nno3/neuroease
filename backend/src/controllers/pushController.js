/**
 * Push controller – VAPID public key and save push subscription.
 * Caregivers and patients can save subscriptions (JWT identifies user).
 */
const { PushSubscription: PushSubscriptionModel } = require('../models');
const { configureVapid } = require('../utils/pushService');

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for the client to subscribe. No auth required so the key can be fetched before login; subscription save requires auth.
 */
function getVapidPublicKey(req, res) {
  configureVapid();
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({
      success: false,
      message: 'Web push is not configured (missing VAPID_PUBLIC_KEY)',
    });
  }
  res.json({ success: true, data: { publicKey: key } });
}

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth } } (from pushManager.subscribe()).
 * Stores subscription for the authenticated user (req.user.userId). Replaces or adds per endpoint.
 */
async function saveSubscription(req, res) {
  // Both caregivers and patients can register push subscriptions
  const userId = req.user.userId;
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({
      success: false,
      message: 'Missing endpoint or keys.p256dh / keys.auth',
    });
  }
  try {
    const [sub] = await PushSubscriptionModel.findOrCreate({
      where: { userId, endpoint },
      defaults: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });
    if (!sub.isNewRecord) {
      await sub.update({ p256dh: keys.p256dh, auth: keys.auth });
    }
    res.json({ success: true, message: 'Subscription saved' });
  } catch (err) {
    console.error('Save push subscription error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to save subscription',
    });
  }
}

/**
 * GET /api/push/status
 * Returns whether the authenticated user has any push subscriptions (for Profile UI).
 */
async function getPushStatus(req, res) {
  const count = await PushSubscriptionModel.count({
    where: { userId: req.user.userId },
  });
  res.json({ success: true, data: { count } });
}

module.exports = {
  getVapidPublicKey,
  saveSubscription,
  getPushStatus,
};
