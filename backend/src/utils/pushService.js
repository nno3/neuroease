/**
 * Web Push service – sends push notifications via web-push (VAPID).
 * Used by the reminder job when patient preference is "push".
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (optional; if missing, push is skipped).
 */
const webpush = require('web-push');

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(
        'mailto:support@neuroease.com',
        publicKey,
        privateKey
      );
      vapidConfigured = true;
    } catch (err) {
      console.error('Push service: VAPID config failed:', err.message);
    }
  }
  return vapidConfigured;
}

/**
 * Send a push notification to one subscription.
 * @param {{ endpoint: string, p256dh: string, auth: string }} sub - Subscription from DB
 * @param {{ title: string, body?: string }} payload - Notification content
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendPush(sub, payload) {
  if (!configureVapid()) {
    return { sent: false, error: 'VAPID not configured' };
  }
  const subscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    await webpush.sendNotification(subscription, payloadStr);
    return { sent: true };
  } catch (err) {
    const msg = err.message || String(err);
    console.error('Push send error:', msg, err.statusCode, err.body);
    return { sent: false, error: msg };
  }
}

module.exports = { configureVapid, sendPush };
