/**
 * Express application factory – REST routes and middleware only.
 * Socket.IO is attached in server.js after createServer(app); then app.set('io', io).
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

/** Safe default so handlers that call req.app.get('io') never see undefined in tests. */
function createStubIo() {
    const noop = () => {};
    return { to: () => ({ emit: noop }) };
}

function normalizeWebOrigin(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    try {
        return new URL(s).origin;
    } catch {
        return null;
    }
}

const allowedOriginSet = new Set(
    [
        process.env.FRONTEND_URL,
        process.env.PATIENT_APP_URL,
        'http://localhost:5173',
        'http://localhost:5175',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5175',
    ]
        .map(normalizeWebOrigin)
        .filter(Boolean)
);

const isDevLocalOrigin = (origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin || '');

const isPrivateLanOrigin = (origin) =>
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
        origin || ''
    );

function corsOriginCallback(origin, callback) {
    if (!origin) return callback(null, true);
    const reqOrigin = normalizeWebOrigin(origin);
    if (reqOrigin && allowedOriginSet.has(reqOrigin)) return callback(null, true);
    if (
        process.env.NODE_ENV !== 'production' &&
        (isDevLocalOrigin(origin) || isPrivateLanOrigin(origin))
    ) {
        return callback(null, true);
    }
    callback(null, false);
}

function createHttpApp() {
    const app = express();
    app.set('io', createStubIo());

    if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('combined'));
    }

    app.use(
        cors({
            origin: corsOriginCallback,
            credentials: true,
        })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const authRoutes = require('./routes/authRoutes');
    app.use('/api/auth', authRoutes);

    const patientRoutes = require('./routes/patientRoutes');
    app.use('/api/patients', patientRoutes);

    const reminderRoutes = require('./routes/reminderRoutes');
    app.use('/api/reminders', reminderRoutes);

    const activityRoutes = require('./routes/activityRoutes');
    app.use('/api/activity', activityRoutes);

    const locationRoutes = require('./routes/locationRoutes');
    app.use('/api/location', locationRoutes);

    const pushRoutes = require('./routes/pushRoutes');
    app.use('/api/push', pushRoutes);

    const safeZoneRoutes = require('./routes/safeZoneRoutes');
    app.use('/api/safe-zones', safeZoneRoutes);

    const gameRoutes = require('./routes/gameRoutes');
    app.use('/api/games', gameRoutes);

    const messageRoutes = require('./routes/messageRoutes');
    app.use('/api/messages', messageRoutes);

    app.get('/api/health', (req, res) => {
        res.json({
            success: true,
            message: 'NeuroEase Backend is running',
            timestamp: new Date().toISOString(),
            database: 'PostgreSQL',
            environment: process.env.NODE_ENV,
        });
    });

    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found',
        });
    });

    app.use((error, req, res, next) => {
        console.error('Unhandled error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    });

    return app;
}

module.exports = { createHttpApp, createStubIo, corsOriginCallback };
