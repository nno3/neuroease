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

/** Set by Render — used to log SMTP limitations on free tier */
function isRunningOnRender() {
    return process.env.RENDER === 'true' || process.env.RENDER === '1';
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

    const mailPayload = {
        from: MAIL_FROM,
        to: email,
        subject: 'Activate your NeuroEase account',
        html,
        text,
    };

    const resend = getResendClient();
    const transporter = await getTransporter();

    // Render free tier blocks outbound SMTP (ports 25/465/587) — ETIMEDOUT. Resend uses HTTPS (443).
    // Try Resend first when set so we do not wait ~45s on a blocked SMTP socket.
    if (resend) {
        try {
            const { error } = await resend.emails.send(mailPayload);
            if (!error) {
                return { sent: true };
            }
            console.warn('Resend invite failed, trying SMTP:', error.message);
        } catch (err) {
            console.warn('Resend invite threw, trying SMTP:', err.message);
        }
    }

    if (transporter) {
        try {
            await transporter.sendMail(mailPayload);
            return { sent: true };
        } catch (err) {
            console.error('Send patient invite email error (SMTP):', err);
            if (
                isRunningOnRender()
                && (err.code === 'ETIMEDOUT' || String(err.message || '').includes('timeout'))
            ) {
                console.error(
                    'RENDER: Free-tier web services block outbound SMTP.'
                );
            }
            return { sent: false, error: err.message };
        }
    }

    if (resend) {
        return {
            sent: false,
            error: 'Resend failed and SMTP is not configured',
        };
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
    const textBody = `Hi ${name || 'there'},\n\nLog in here: ${loginUrl}${textCode}\n\nLink and code expire in 15 minutes.\n\n— NeuroEase`;

    const mailPayload = {
        from: MAIL_FROM,
        to: email,
        subject: 'Log in to NeuroEase',
        html,
        text: textBody,
    };

    const resend = getResendClient();
    const transporter = await getTransporter();

    // Same as invite: Resend first (HTTPS) — Render blocks SMTP.
    if (resend) {
        try {
            const { error } = await resend.emails.send(mailPayload);
            if (!error) {
                return { sent: true };
            }
            console.warn('Resend magic link failed, trying SMTP:', error.message);
        } catch (err) {
            console.warn('Resend magic link threw, trying SMTP:', err.message);
        }
    }

    if (transporter) {
        try {
            await transporter.sendMail(mailPayload);
            return { sent: true };
        } catch (err) {
            console.error('Send magic link email error (SMTP):', err);
            if (
                isRunningOnRender()
                && (err.code === 'ETIMEDOUT' || String(err.message || '').includes('timeout'))
            ) {
                console.error(
                    'RENDER: Free-tier web services block outbound SMTP.'
                );
            }
            return { sent: false, error: err.message };
        }
    }

    if (resend) {
        return { sent: false, error: 'Resend failed and SMTP is not configured' };
    }

    console.warn('Neither Resend nor SMTP configured. Magic link (no email sent):');
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

/**
 * Send meeting notification emails to both caregiver and patient when a meeting is accepted.
 * @param {{ caregiverEmail, caregiverName, patientEmail, patientName, meetingTime: Date, note: string }} opts
 */
async function sendMeetingAcceptedEmails({ caregiverEmail, caregiverName, patientEmail, patientName, meetingTime, note }) {
    const formatted = new Date(meetingTime).toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    const sharedNote = note ? `<p style="color:#475569;font-size:14px;"><strong>Note:</strong> ${note}</p>` : '';
    const sharedNoteTxt = note ? `\nNote: ${note}` : '';

    const caregiverHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;line-height:1.6;color:#334155;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#1e293b;margin-bottom:4px">Meeting confirmed ✓</h2>
  <p>Hi ${caregiverName || 'there'},</p>
  <p><strong>${patientName || 'Your patient'}</strong> has accepted your meeting request.</p>
  <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:0;font-size:15px;font-weight:600;color:#166534">📅 ${formatted}</p>
  </div>
  ${sharedNote}
  <p>This meeting has been added to your NeuroEase calendar.</p>
  <p>— NeuroEase</p>
</body></html>`;

    const patientHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;line-height:1.6;color:#334155;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#1e293b;margin-bottom:4px">Meeting scheduled ✓</h2>
  <p>Hi ${patientName || 'there'},</p>
  <p>You accepted a meeting with your caregiver <strong>${caregiverName || ''}</strong>.</p>
  <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:0;font-size:15px;font-weight:600;color:#1d4ed8">📅 ${formatted}</p>
  </div>
  ${sharedNote}
  <p>A reminder has been added to your NeuroEase app.</p>
  <p>— NeuroEase</p>
</body></html>`;

    const resend = getResendClient();
    const transporter = await getTransporter();

    const sendOne = async (to, subject, html, text) => {
        const payload = { from: MAIL_FROM, to, subject, html, text };
        if (resend) {
            try {
                const { error } = await resend.emails.send(payload);
                if (!error) return { sent: true };
                console.warn('Resend meeting email failed, trying SMTP:', error.message);
            } catch (err) {
                console.warn('Resend meeting email threw, trying SMTP:', err.message);
            }
        }
        if (transporter) {
            try {
                await transporter.sendMail(payload);
                return { sent: true };
            } catch (err) {
                console.error('SMTP meeting email error:', err.message);
                return { sent: false, error: err.message };
            }
        }
        console.warn('No email transport configured. Meeting email not sent to:', to);
        return { sent: false };
    };

    await Promise.allSettled([
        sendOne(
            caregiverEmail,
            `Meeting confirmed with ${patientName || 'your patient'} – ${formatted}`,
            caregiverHtml,
            `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} accepted your meeting.\n\n📅 ${formatted}${sharedNoteTxt}\n\n— NeuroEase`
        ),
        sendOne(
            patientEmail,
            `Meeting scheduled with ${caregiverName || 'your caregiver'} – ${formatted}`,
            patientHtml,
            `Hi ${patientName || 'there'},\n\nYou accepted a meeting with ${caregiverName || 'your caregiver'}.\n\n📅 ${formatted}${sharedNoteTxt}\n\n— NeuroEase`
        ),
    ]);
}

async function sendNewMessageEmail(toEmail, toName, senderName, isMeetingRequest, appUrl, overrides = {}) {
    const subject = overrides.subject ?? (isMeetingRequest
        ? `${senderName || 'Your contact'} sent you a meeting request`
        : `New message from ${senderName || 'your contact'}`);

    const actionLabel = isMeetingRequest ? 'View Meeting Request' : 'View Message';
    const bodyLine = overrides.bodyLine ?? (isMeetingRequest
        ? `<strong>${senderName || 'Your contact'}</strong> has sent you a meeting request.`
        : `<strong>${senderName || 'Your contact'}</strong> has sent you a new message.`);

    const link = appUrl ? `${appUrl}/messages` : null;
    const buttonHtml = link
        ? `<a href="${link}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${actionLabel}</a>`
        : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;line-height:1.6;color:#334155;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#1e293b;margin-bottom:4px">${isMeetingRequest ? '📅 Meeting Request' : '💬 New Message'}</h2>
  <p>Hi ${toName || 'there'},</p>
  <p>${bodyLine}</p>
  <p>Log in to NeuroEase to respond.</p>
  ${buttonHtml}
  <p style="margin-top:24px">— NeuroEase</p>
</body></html>`;

    const text = `Hi ${toName || 'there'},\n\n${senderName || 'Your patient'} ${isMeetingRequest ? 'sent you a meeting request' : 'sent you a new message'}.\n\nLog in to NeuroEase to respond.${link ? `\n${link}` : ''}\n\n— NeuroEase`;

    const resend = getResendClient();
    const transporter = await getTransporter();
    const payload = { from: MAIL_FROM, to: toEmail, subject, html, text };

    if (resend) {
        try {
            const { error } = await resend.emails.send(payload);
            if (!error) return { sent: true };
            console.warn('Resend new-message email failed, trying SMTP:', error.message);
        } catch (err) {
            console.warn('Resend new-message email threw, trying SMTP:', err.message);
        }
    }
    if (transporter) {
        try {
            await transporter.sendMail(payload);
            return { sent: true };
        } catch (err) {
            console.error('SMTP new-message email error:', err.message);
            return { sent: false, error: err.message };
        }
    }
    console.warn('No email transport configured. New-message email not sent to:', toEmail);
    return { sent: false };
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
    sendMeetingAcceptedEmails,
    sendNewMessageEmail,
};
