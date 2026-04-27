/**
 * All transactional email uses the Resend HTTP API (HTTPS / 443).
 * Configure RESEND_API_KEY and MAIL_FROM (verified domain or onboarding@resend.dev).
 * See docs/Email-and-Resend.md
 */
const { Resend } = require('resend');

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

/**
 * @returns {Promise<{ ok: true } | { ok: false, noKey?: boolean, error?: string }>}
 */
async function resendOnlySend({ from, to, subject, html, text }) {
    const resend = getResendClient();
    if (!resend) {
        return { ok: false, noKey: true };
    }
    try {
        const { data, error } = await resend.emails.send({
            from,
            to,
            subject,
            html,
            text: text || undefined,
        });
        if (error) {
            return { ok: false, error: error.message || String(error) };
        }
        return { ok: true, id: data?.id };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
}

/**
 * Caregiver sign-up: verify-email link. Resend only (same `MAIL_FROM` / domain as patient mail).
 * Without RESEND_API_KEY, logs the link to the server console for local testing.
 */
async function sendVerificationEmail(email, name, token) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const textBody = `Hi ${name || 'there'},\n\nPlease verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.\n\n— NeuroEase`;
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

    const mailPayload = {
        from: MAIL_FROM,
        to: email,
        subject: 'Verify your NeuroEase account',
        html,
        text: textBody,
    };

    const result = await resendOnlySend(mailPayload);
    if (result.ok) {
        console.log(
            '[EMAIL] Verification email sent via Resend to:',
            email,
            result.id ? `(id: ${result.id})` : ''
        );
        return { sent: true };
    }
    if (result.noKey) {
        console.warn('[EMAIL] Set RESEND_API_KEY and MAIL_FROM (verified in Resend) — see docs/Email-and-Resend.md');
    } else {
        console.error('[EMAIL] Resend verification failed:', result.error);
    }
    console.log('--- Caregiver verification link (use if email not received) ---');
    console.log('To:', email);
    console.log('Verify link:', verifyUrl);
    console.log('---');
    if (result.noKey) {
        return { sent: false, noKey: true };
    }
    return { sent: false, error: result.error };
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

    const result = await resendOnlySend(mailPayload);
    if (result.ok) {
        return { sent: true };
    }
    if (result.noKey) {
        console.warn('[EMAIL] Set RESEND_API_KEY and MAIL_FROM — see docs/Email-and-Resend.md. Patient invite (no email sent):');
        console.log('To:', email, '| Activate link:', activateUrl);
        return { sent: true };
    }
    return { sent: false, error: result.error };
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

    const result = await resendOnlySend(mailPayload);
    if (result.ok) {
        return { sent: true };
    }
    if (result.noKey) {
        console.warn('[EMAIL] Set RESEND_API_KEY and MAIL_FROM. Magic link (no email sent):');
        console.log('To:', email, '| Login link:', loginUrl);
        if (shortCode) console.log('Short code:', shortCode);
        return { sent: true };
    }
    return { sent: false, error: result.error };
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
    const text = `Hi ${name || 'there'},\n\nReminder: ${reminderTitle || 'Reminder'}\n${reminderMessage ? reminderMessage + '\n' : ''}\nScheduled for ${timeStr}. Open the NeuroEase app to mark it done.\n\n— NeuroEase`;
    const r = await resendOnlySend({
        from: MAIL_FROM,
        to: email,
        subject: `Reminder: ${(reminderTitle || 'Reminder').slice(0, 50)}`,
        html,
        text,
    });
    if (r.ok) {
        return { sent: true };
    }
    if (r.noKey) {
        console.warn('[EMAIL] Reminder email not sent (no RESEND_API_KEY):', { to: email, title: reminderTitle });
        return { sent: true };
    }
    console.error('Resend reminder email error:', r.error);
    return { sent: false, error: r.error };
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
    const text = `URGENT\n\nHi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} has left their safe zone at ${timeStr}.\n\n${linksText}— NeuroEase`;
    const r = await resendOnlySend({
        from: MAIL_FROM,
        to: caregiverEmail,
        subject: `URGENT: ${patientName || 'Patient'} left safe zone`,
        html,
        text,
    });
    if (r.ok) return { sent: true };
    if (r.noKey) {
        console.warn('[EMAIL] Location alert not sent (no RESEND_API_KEY):', { to: caregiverEmail });
        return { sent: true };
    }
    return { sent: false, error: r.error };
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
    const textR = `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} has returned to their safe zone at ${timeStr}.\n\n${linksText}— NeuroEase`;
    const r2 = await resendOnlySend({
        from: MAIL_FROM,
        to: caregiverEmail,
        subject: `${patientName || 'Patient'} returned to safe zone`,
        html,
        text: textR,
    });
    if (r2.ok) return { sent: true };
    if (r2.noKey) {
        console.warn('[EMAIL] Returned-to-zone email not sent (no RESEND_API_KEY):', { to: caregiverEmail });
        return { sent: true };
    }
    return { sent: false, error: r2.error };
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
    const r3 = await resendOnlySend({
        from: MAIL_FROM,
        to: caregiverEmail,
        subject: `NeuroEase: ${patientName || 'Patient'} missed reminder`,
        html,
        text: `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} missed the reminder "${reminderTitle || 'Reminder'}" (due ${timeStr}).\n\nLog in to the NeuroEase dashboard.\n\n— NeuroEase`,
    });
    if (r3.ok) return { sent: true };
    if (r3.noKey) {
        console.warn('[EMAIL] Missed-reminder email not sent (no RESEND_API_KEY):', { to: caregiverEmail });
        return { sent: true };
    }
    return { sent: false, error: r3.error };
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
    const r4 = await resendOnlySend({
        from: MAIL_FROM,
        to: caregiverEmail,
        subject: `NeuroEase: ${patientName || 'Patient'} completed ${gameLabel}`,
        html,
        text: `Hi ${caregiverName || 'there'},\n\n${patientName || 'Your patient'} completed ${gameLabel} (${scoreStr}, Duration: ${durationStr}).\n\nLog in to the NeuroEase dashboard.\n\n— NeuroEase`,
    });
    if (r4.ok) return { sent: true };
    if (r4.noKey) {
        console.warn('[EMAIL] Game completion email not sent (no RESEND_API_KEY):', { to: caregiverEmail });
        return { sent: true };
    }
    return { sent: false, error: r4.error };
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

    const sendOne = async (to, subject, html, text) => {
        const r = await resendOnlySend({ from: MAIL_FROM, to, subject, html, text });
        if (r.ok) {
            return { sent: true };
        }
        if (r.noKey) {
            console.warn('[EMAIL] Meeting email not sent (no RESEND_API_KEY):', to);
            return { sent: false };
        }
        console.error('Resend meeting email error:', r.error, to);
        return { sent: false, error: r.error };
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

    const r = await resendOnlySend({ from: MAIL_FROM, to: toEmail, subject, html, text });
    if (r.ok) {
        return { sent: true };
    }
    if (r.noKey) {
        console.warn('[EMAIL] New-message email not sent (no RESEND_API_KEY):', toEmail);
        return { sent: false };
    }
    console.error('Resend new-message email error:', r.error, toEmail);
    return { sent: false, error: r.error };
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
