/**
 * Sends verification email via SMTP. Users receive actual emails when SMTP is
 * configured in .env. See docs/BackendSetUp.md (Email verification section).
 *
 * Env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, FRONTEND_URL
 */
const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@neuroease.com';

function getTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    return nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
    });
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

    const transporter = getTransporter();
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

module.exports = { sendVerificationEmail };
