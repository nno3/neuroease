/**
 * Sends email via Resend (preferred on Render) or SMTP.
 * Resend works reliably from cloud; Gmail SMTP often fails (IPv6, blocks).
 *
 * Env: RESEND_API_KEY (use Resend) OR SMTP_HOST, SMTP_USER, SMTP_PASS
 *      MAIL_FROM, FRONTEND_URL, PATIENT_APP_URL
 */
const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

/**
 * Nodemailer 8+ resolves IPv4+IPv6 and randomly picks one — Render has no IPv6 outbound.
 * Fix: connect to an IPv4 literal; tls.servername stays the real hostname (Gmail cert/SNI).
 */
let smtpResolvedIpv4 = null;
let smtpResolvedForHost = null;
let cachedTransporter = null;
let cachedTransporterKey = null;

/** Resolve hostname to one IPv4 — avoids nodemailer's random IPv6 choice on cloud hosts */
async function resolveSmtpIPv4(hostname) {
    try {
        const addrs = await dns.promises.resolve4(hostname);
        if (addrs && addrs.length) return addrs[0];
    } catch (_) {
        /* fall through */
    }
    try {
        const r = await dns.promises.lookup(hostname, { family: 4 });
        return typeof r === 'string' ? r : r.address;
    } catch (_) {
        return null;
    }
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PATIENT_APP_URL = process.env.PATIENT_APP_URL || 'http://localhost:5175';
const MAIL_FROM = process.env.MAIL_FROM || 'NeuroEase <onboarding@resend.dev>';

function useResend() {
    return !!process.env.RESEND_API_KEY;
}

function getResendClient() {
    if (!useResend()) return null;
    return new Resend(process.env.RESEND_API_KEY);
}

async function getTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = String(process.env.SMTP_PORT || '587');
    if (!host || !user || !pass) return null;

    const cacheKey = `${host}:${user}:${port}:${process.env.SMTP_SECURE || ''}`;
    if (cachedTransporter && cachedTransporterKey === cacheKey) {
        return cachedTransporter;
    }

    let connectHost = host;
    const tlsServername = host;

    if (!net.isIP(host)) {
        if (smtpResolvedForHost !== host) {
            smtpResolvedIpv4 = await resolveSmtpIPv4(host);
            smtpResolvedForHost = host;
            if (smtpResolvedIpv4) {
                console.log(`SMTP connect via IPv4 ${smtpResolvedIpv4} → ${host} (TLS servername unchanged)`);
            } else {
                console.warn('SMTP could not resolve IPv4 for', host, '— delivery may fail on hosts without IPv6 (e.g. Render)');
            }
        }
        if (smtpResolvedIpv4) {
            connectHost = smtpResolvedIpv4;
        }
    }

    cachedTransporter = nodemailer.createTransport({
        host: connectHost,
        port: parseInt(port, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
        connectionTimeout: 45000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        tls: {
            servername: tlsServername,
        },
    });
    cachedTransporterKey = cacheKey;
    return cachedTransporter;
}

/**
 * Send verification email. Returns { sent: true } only when email was sent via SMTP.
 * When SMTP is not configured, logs the link and returns { sent: true } so registration
 * still succeeds; user must set up SMTP to receive actual emails.
 *
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name (for greeting)
 * @param {string} token - Verification token
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendVerificationEmail(email, name, token) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${name || 'there'},</p>
  <p>Thanks for signing up for NeuroEase. Please verify your email by clicking the link below:</p>
  <p><a href="${verifyUrl}" style="color: #4A90E2; font-weight: 600;">Verify my email</a></p>
  <p>Or copy and paste this URL into your browser:</p>
  <p style="word-break: break-all;">${verifyUrl}</p>
  <p>This link expires in 24 hours.</p>
  <p>If you didn't create an account, you can ignore this email.</p>
  <p>— NeuroEase</p>
</body>
</html>`;

    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: email,
                subject: 'Verify your NeuroEase account',
                html,
                text: `Hi ${name || 'there'},\n\nPlease verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.\n\n— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send verification email error:', err);
            return { sent: false, error: err.message };
        }
    }

    console.warn('SMTP not configured. Users will NOT receive verification emails. Set SMTP_* and MAIL_FROM in .env — see docs/BackendSetUp.md');
    console.log('--- Verification link (no email sent) ---');
    console.log('To:', email);
    console.log('Verify link:', verifyUrl);
    console.log('---');
    return { sent: true };
}

/**
 * Send patient invite email (activate account). Link opens patient app /activate?token=...
 */
async function sendPatientInviteEmail(email, name, token) {
    const activateUrl = `${PATIENT_APP_URL}/activate?token=${encodeURIComponent(token)}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${name || 'there'},</p>
  <p>Your caregiver has set up NeuroEase for you. Open the link below to activate your account and start using the app:</p>
  <p><a href="${activateUrl}" style="color: #4A90E2; font-weight: 600;">Activate my account</a></p>
  <p>Or copy and paste this URL into your browser:</p>
  <p style="word-break: break-all;">${activateUrl}</p>
  <p>This link expires in 7 days. If you didn't expect this email, you can ignore it.</p>
  <p>— NeuroEase</p>
</body>
</html>`;
    const text = `Hi ${name || 'there'},\n\nOpen this link to activate your account: ${activateUrl}\n\nThis link expires in 7 days.\n\n— NeuroEase`;

    const resend = getResendClient();
    if (resend) {
        try {
            const { error } = await resend.emails.send({
                from: MAIL_FROM,
                to: email,
                subject: 'Activate your NeuroEase account',
                html,
                text,
            });
            if (error) {
                console.error('Resend invite email error:', error);
                return { sent: false, error: error.message };
            }
            return { sent: true };
        } catch (err) {
            console.error('Send patient invite email error:', err);
            return { sent: false, error: err.message };
        }
    }

    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: email,
                subject: 'Activate your NeuroEase account',
                html,
                text,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send patient invite email error:', err);
            return { sent: false, error: err.message };
        }
    }

    console.warn('Neither Resend nor SMTP configured. Patient invite (no email sent):');
    console.log('To:', email, '| Activate link:', activateUrl);
    return { sent: true };
}

/**
 * Send patient magic link (login). Link opens patient app /login?token=...
 * shortCode: 6-digit code so user can log in from the home-screen app without opening the link in Safari.
 */
async function sendPatientMagicLinkEmail(email, name, token, shortCode) {
    const loginUrl = `${PATIENT_APP_URL}/login?token=${encodeURIComponent(token)}`;
    const codeBlock = shortCode
        ? `<p><strong>Or, if you opened the app from your home screen:</strong> enter this code in the app (same email + this code): <strong style="font-size: 1.2em; letter-spacing: 0.1em;">${shortCode}</strong></p>`
        : '';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${name || 'there'},</p>
  <p>Use the link below to log in to NeuroEase:</p>
  <p><a href="${loginUrl}" style="color: #4A90E2; font-weight: 600;">Log in to NeuroEase</a></p>
  ${codeBlock}
  <p>Or copy and paste this URL into your browser:</p>
  <p style="word-break: break-all;">${loginUrl}</p>
  <p>This link and code expire in 15 minutes. If you didn't request this, you can ignore this email.</p>
  <p>— NeuroEase</p>
</body>
</html>`;
    const textCode = shortCode ? `\n\nOr enter this code in the app (from your home screen): ${shortCode}` : '';
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: email,
                subject: 'Log in to NeuroEase',
                html,
                text: `Hi ${name || 'there'},\n\nLog in here: ${loginUrl}${textCode}\n\nLink and code expire in 15 minutes.\n\n— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send magic link email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Magic link (no email sent):');
    console.log('--- Magic link (login) ---');
    console.log('To:', email);
    console.log('Login link:', loginUrl);
    if (shortCode) console.log('Short code:', shortCode);
    console.log('---');
    return { sent: true };
}

/**
 * Send reminder-due email to patient. Used by the reminder notification job.
 * @param {string} email - Recipient (patient) email
 * @param {string} name - Patient name (for greeting)
 * @param {string} reminderTitle - Reminder title
 * @param {string} reminderMessage - Reminder message
 * @param {Date|string} scheduledTime - When the reminder was scheduled
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendReminderEmail(email, name, reminderTitle, reminderMessage, scheduledTime) {
    const timeStr = scheduledTime instanceof Date
        ? scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${name || 'there'},</p>
  <p>This is a reminder:</p>
  <p><strong>${(reminderTitle || 'Reminder').replace(/</g, '&lt;')}</strong></p>
  ${reminderMessage ? `<p>${String(reminderMessage).replace(/</g, '&lt;')}</p>` : ''}
  <p>Scheduled for ${timeStr}. Open the NeuroEase app to mark it done.</p>
  <p>— NeuroEase</p>
</body>
</html>`;
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: email,
                subject: `Reminder: ${(reminderTitle || 'Reminder').slice(0, 50)}`,
                html,
                text: `Hi ${name || 'there'},\n\nReminder: ${reminderTitle || 'Reminder'}\n${reminderMessage ? reminderMessage + '\n' : ''}\nScheduled for ${timeStr}. Open the NeuroEase app to mark it done.\n\n— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send reminder email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Reminder email (not sent):', { to: email, title: reminderTitle });
    return { sent: true };
}

/**
 * Send email to caregiver when patient leaves safe zone.
 * Uses urgent subject and styling to highlight the alert.
 * Includes links to dashboard and Google Maps for directions.
 */
async function sendCaregiverLocationAlertEmail(caregiverEmail, caregiverName, patientName, timestamp, patientId, latitude, longitude) {
    const timeStr = timestamp instanceof Date
        ? timestamp.toLocaleString()
        : new Date(timestamp).toLocaleString();
    const safeName = (patientName || 'Your patient').replace(/</g, '&lt;');
    const dashboardUrl = `${FRONTEND_URL}/location${patientId != null ? `?patientId=${encodeURIComponent(patientId)}` : ''}`;
    const mapsUrl = (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude))
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`
        : null;
    const linksHtml = mapsUrl
        ? `<p><a href="${dashboardUrl}" style="color: #4A90E2; font-weight: 600;">View on NeuroEase map</a> &nbsp;|&nbsp; <a href="${mapsUrl}" style="color: #4A90E2; font-weight: 600;">Get directions (Google Maps)</a></p>`
        : `<p><a href="${dashboardUrl}" style="color: #4A90E2; font-weight: 600;">View on NeuroEase map</a></p>`;
    const linksText = mapsUrl
        ? `View on map: ${dashboardUrl}\nGet directions: ${mapsUrl}\n\n`
        : `View on map: ${dashboardUrl}\n\n`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${caregiverName || 'there'},</p>
  <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #b91c1c;">⚠ URGENT</p>
    <p style="margin: 0; font-size: 15px;"><strong>${safeName}</strong> has left their safe zone.</p>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Time: ${timeStr}</p>
  </div>
  ${linksHtml}
  <p>— NeuroEase</p>
</body>
</html>`;
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: caregiverEmail,
                subject: `URGENT: ${patientName || 'Patient'} left safe zone`,
                html,
                text: `URGENT\n\nHi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} has left their safe zone at ${timeStr}.\n\n${linksText}— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send caregiver location alert email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Caregiver location alert (not sent):', { to: caregiverEmail });
    return { sent: true };
}

/**
 * Send email to caregiver when patient returns to safe zone.
 * Calm, reassuring tone (not alarming) to confirm their safety.
 * Includes links to dashboard and Google Maps.
 */
async function sendCaregiverReturnedToZoneEmail(caregiverEmail, caregiverName, patientName, timestamp, patientId, latitude, longitude) {
    const timeStr = timestamp instanceof Date
        ? timestamp.toLocaleString()
        : new Date(timestamp).toLocaleString();
    const safeName = (patientName || 'Your patient').replace(/</g, '&lt;');
    const dashboardUrl = `${FRONTEND_URL}/location${patientId != null ? `?patientId=${encodeURIComponent(patientId)}` : ''}`;
    const mapsUrl = (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude))
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`
        : null;
    const linksHtml = mapsUrl
        ? `<p><a href="${dashboardUrl}" style="color: #4A90E2; font-weight: 600;">View on NeuroEase map</a> &nbsp;|&nbsp; <a href="${mapsUrl}" style="color: #4A90E2; font-weight: 600;">Get directions (Google Maps)</a></p>`
        : `<p><a href="${dashboardUrl}" style="color: #4A90E2; font-weight: 600;">View on NeuroEase map</a></p>`;
    const linksText = mapsUrl
        ? `View on map: ${dashboardUrl}\nGet directions: ${mapsUrl}\n\n`
        : `View on map: ${dashboardUrl}\n\n`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${caregiverName || 'there'},</p>
  <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0; font-size: 15px; color: #166534;"><strong>${safeName}</strong> has returned to their safe zone.</p>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #64748b;">Time: ${timeStr}</p>
  </div>
  ${linksHtml}
  <p>— NeuroEase</p>
</body>
</html>`;
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: caregiverEmail,
                subject: `${patientName || 'Patient'} returned to safe zone`,
                html,
                text: `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} has returned to their safe zone at ${timeStr}.\n\n${linksText}— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send caregiver returned to zone email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Caregiver returned to zone (not sent):', { to: caregiverEmail });
    return { sent: true };
}

/**
 * Send email to caregiver when patient misses a reminder (overdue).
 */
async function sendCaregiverMissedReminderEmail(caregiverEmail, caregiverName, patientName, reminderTitle, scheduledTime) {
    const timeStr = scheduledTime instanceof Date
        ? scheduledTime.toLocaleString()
        : new Date(scheduledTime).toLocaleString();
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${caregiverName || 'there'},</p>
  <p><strong>${(patientName || 'Your patient').replace(/</g, '&lt;')}</strong> has missed a reminder.</p>
  <p><strong>${(reminderTitle || 'Reminder').replace(/</g, '&lt;')}</strong></p>
  <p>Was due: ${timeStr}</p>
  <p>Log in to the NeuroEase dashboard to view reminder status and activity.</p>
  <p>— NeuroEase</p>
</body>
</html>`;
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: caregiverEmail,
                subject: `NeuroEase: ${patientName || 'Patient'} missed reminder`,
                html,
                text: `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} missed the reminder "${reminderTitle || 'Reminder'}" (due ${timeStr}).\n\nLog in to the NeuroEase dashboard.\n\n— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send caregiver missed reminder email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Caregiver missed reminder (not sent):', { to: caregiverEmail });
    return { sent: true };
}

/**
 * Format score for caregiver email based on game type and optional maxScore/difficulty.
 */
function formatGameScoreForEmail(gameType, score, maxScore, difficulty) {
    const s = score ?? 0;
    const hasMax = maxScore != null && Number.isFinite(maxScore) && maxScore > 0;
    if (gameType === 'memory' && hasMax) {
        return `${maxScore} pairs in ${s} moves`;
    }
    if (gameType === 'math' && hasMax) {
        const diffStr = difficulty ? ` (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty)` : '';
        return `${s}/${maxScore} correct${diffStr}`;
    }
    if (hasMax) {
        return `${s}/${maxScore}`;
    }
    return String(s);
}

/**
 * Send email to caregiver when patient completes a game.
 * maxScore and difficulty are optional for clearer score display (e.g. math: 7/10 Easy, memory: 8 pairs in 12 moves).
 */
async function sendCaregiverGameCompletionEmail(caregiverEmail, caregiverName, patientName, gameType, score, duration, maxScore, difficulty) {
    const gameLabel = { memory: 'Memory Match', math: 'Math Practice', sequencing: 'Sequencing' }[gameType] || gameType;
    const durationStr = duration != null ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '—';
    const scoreStr = formatGameScoreForEmail(gameType, score, maxScore, difficulty);
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #334155;">
  <p>Hi ${caregiverName || 'there'},</p>
  <p><strong>${(patientName || 'Your patient').replace(/</g, '&lt;')}</strong> completed a game.</p>
  <p><strong>${gameLabel}</strong> – ${scoreStr}, Duration: ${durationStr}</p>
  <p>Log in to the NeuroEase dashboard to view activity and performance.</p>
  <p>— NeuroEase</p>
</body>
</html>`;
    const transporter = await getTransporter();
    if (transporter) {
        try {
            await transporter.sendMail({
                from: MAIL_FROM,
                to: caregiverEmail,
                subject: `NeuroEase: ${patientName || 'Patient'} completed ${gameLabel}`,
                html,
                text: `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} completed ${gameLabel} (${scoreStr}, Duration: ${durationStr}).\n\nLog in to the NeuroEase dashboard.\n\n— NeuroEase`,
            });
            return { sent: true };
        } catch (err) {
            console.error('Send caregiver game completion email error:', err);
            return { sent: false, error: err.message };
        }
    }
    console.warn('SMTP not configured. Caregiver game completion (not sent):', { to: caregiverEmail });
    return { sent: true };
}

module.exports = {
    sendVerificationEmail,
    sendPatientInviteEmail,
    sendPatientMagicLinkEmail,
    sendReminderEmail,
    sendCaregiverLocationAlertEmail,
    sendCaregiverReturnedToZoneEmail,
    sendCaregiverMissedReminderEmail,
    sendCaregiverGameCompletionEmail,
};
