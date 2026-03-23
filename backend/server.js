/**
 * NeuroEase Backend – Express server entry point.
 * Mounts API routes, connects to PostgreSQL via Sequelize, and handles 404/500.
 * Environment: .env (PORT, DB_*, JWT_SECRET, SMTP_*, PATIENT_APP_URL, FRONTEND_URL).
 */
require('dotenv').config();

// Force IPv4 for SMTP – Render free tier has no IPv6 outbound; Gmail resolves to both
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { sequelize, User } = require('./src/models');
const { startReminderEmailJob } = require('./src/jobs/reminderEmailJob');

const app = express();
const PORT = process.env.PORT || 5001;

/** Warn when Render has SMTP but no Resend — otherwise invite email waits ~45s and times out */
function logEmailDeliveryHint() {
    const onRender = process.env.RENDER === 'true' || process.env.RENDER === '1';
    const hasResend = !!process.env.RESEND_API_KEY;
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (hasResend) {
        console.log('[EMAIL] Resend enabled (RESEND_API_KEY) — HTTPS delivery.');
        return;
    }
    if (onRender && hasSmtp) {
        console.warn(
            '[EMAIL] RESEND_API_KEY is not set but SMTP_* is. Render free tier usually blocks outbound SMTP; invite email will fail or hang. Add RESEND_API_KEY from resend.com — see docs/Deployment.md.'
        );
    } else if (hasSmtp) {
        console.log('[EMAIL] Using SMTP only (no RESEND_API_KEY).');
    }
}

// Log every API request (method, URL, status) for debugging and auditing
app.use(morgan('combined'));

// Allow frontend(s) on different origins to call this API; parse JSON and form bodies
// When credentials are used, we must specify exact origins (no wildcard)
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.PATIENT_APP_URL,
    'http://localhost:5173',
    'http://localhost:5175',
].filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount route modules under /api/* (all require valid DB and env)
const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authRoutes);

const patientRoutes = require('./src/routes/patientRoutes');
app.use('/api/patients', patientRoutes);

const reminderRoutes = require('./src/routes/reminderRoutes');
app.use('/api/reminders', reminderRoutes);

const activityRoutes = require('./src/routes/activityRoutes');
app.use('/api/activity', activityRoutes);

const locationRoutes = require('./src/routes/locationRoutes');
app.use('/api/location', locationRoutes);

const pushRoutes = require('./src/routes/pushRoutes');
app.use('/api/push', pushRoutes);

const safeZoneRoutes = require('./src/routes/safeZoneRoutes');
app.use('/api/safe-zones', safeZoneRoutes);

const gameRoutes = require('./src/routes/gameRoutes');
app.use('/api/games', gameRoutes);

// Quick check for deployment and monitoring
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'NeuroEase Backend is running',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
        environment: process.env.NODE_ENV
    });
});
// No route matched – return consistent JSON so frontend can show a clear message
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Connect to DB, sync models (create/alter tables), then listen
const startServer = async () => {
    try {
        console.log('Testing database connection...');
        await sequelize.authenticate();
        console.log('PostgreSQL connection established successfully');

        // One-time fix: if push_subscriptions exists without user_id, truncate so sync can add NOT NULL user_id
        try {
            const [rows] = await sequelize.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = 'user_id'`
            );
            const hasUserId = Array.isArray(rows) && rows.length > 0;
            if (!hasUserId) {
                const [countResult] = await sequelize.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions'`);
                if (Array.isArray(countResult) && countResult.length > 0) {
                    await sequelize.query('TRUNCATE TABLE push_subscriptions');
                    console.log('push_subscriptions: truncated (table had no user_id column; ready for sync).');
                }
            }
        } catch (e) {
            // Ignore; sync may create table from scratch
        }

        // alter: true updates columns if model changed; avoids dropping data
        console.log('Syncing database tables...');
        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized');

        // Backfill email_hash for existing users (when email is stored but emailHash is null)
        try {
            const { User } = require('./src/models');
            const { hashEmail } = require('./src/utils/encryption');
            const [cols] = await sequelize.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_hash'`
            );
            if (Array.isArray(cols) && cols.length > 0) {
                const users = await User.findAll({ where: { emailHash: null }, attributes: ['id', 'email'] });
                for (const u of users) {
                    const plain = u.email;
                    if (plain && String(plain).trim()) {
                        await u.update({ emailHash: hashEmail(plain) });
                    }
                }
                if (users.length > 0) {
                    console.log(`Backfilled email_hash for ${users.length} user(s).`);
                }
            }
        } catch (e) {
            // Ignore migration errors
        }

        // Ensure push_subscriptions has created_at/updated_at (sync may have dropped them in a prior run)
        try {
            const [cols] = await sequelize.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name IN ('created_at', 'updated_at')`
            );
            const hasCreatedAt = Array.isArray(cols) && cols.some((c) => c.column_name === 'created_at');
            const hasUpdatedAt = Array.isArray(cols) && cols.some((c) => c.column_name === 'updated_at');
            if (!hasCreatedAt || !hasUpdatedAt) {
                if (!hasCreatedAt) await sequelize.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE`);
                if (!hasUpdatedAt) await sequelize.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`);
                console.log('push_subscriptions: added missing created_at/updated_at columns.');
            }
        } catch (e) {
            // Ignore
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`NeuroEase Backend running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
            console.log('API request logging: ENABLED');
            logEmailDeliveryHint();
            startReminderEmailJob();
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();