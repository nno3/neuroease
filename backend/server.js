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
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const jwt = require('jsonwebtoken');

const { sequelize, User } = require('./src/models');
const { startReminderEmailJob } = require('./src/jobs/reminderEmailJob');

const app = express();
const httpServer = http.createServer(app);
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
            '[EMAIL] RESEND_API_KEY is not set but SMTP_* is.'
        );
    } else if (hasSmtp) {
        console.log('[EMAIL] Using SMTP only (no RESEND_API_KEY).');
    }
}

// Log every API request (method, URL, status) for debugging and auditing
app.use(morgan('combined'));

// Allow frontend(s) on different origins. Socket.IO uses the browser's Origin header
// (e.g. http://127.0.0.1:5173 vs http://localhost:5173) — both must be allowed or the
// handshake fails silently while REST via Vite proxy still works.
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.PATIENT_APP_URL,
    'http://localhost:5173',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5175',
].filter(Boolean);

const isDevLocalOrigin = (origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin || '');

/** Phone/tablet on same Wi‑Fi hitting http://192.168.x.x:5173 — allow in dev only */
const isPrivateLanOrigin = (origin) =>
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
        origin || ''
    );

function corsOriginCallback(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (
        process.env.NODE_ENV !== 'production' &&
        (isDevLocalOrigin(origin) || isPrivateLanOrigin(origin))
    ) {
        return callback(null, true);
    }
    callback(null, false);
}

app.use(cors({
    origin: corsOriginCallback,
    credentials: true,
}));

// Socket.io – attach to the http server, same CORS policy
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: corsOriginCallback,
        credentials: true,
    },
});

// Authenticate socket connections with the same JWT used by the REST API
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const uid = decoded.userId ?? decoded.id;
        const n = Number(uid);
        if (!Number.isFinite(n)) {
            return next(new Error('Invalid token payload'));
        }
        socket.userId = n;
        socket.userType = decoded.userType;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

/** Socket.IO rooms use `user:<numeric user id>` — must match JWT userId and client `to` payloads. */
function userRoom(userId) {
    const n = Number(userId);
    if (!Number.isFinite(n)) return null;
    return `user:${n}`;
}

io.on('connection', async (socket) => {
    const myRoom = userRoom(socket.userId);
    // Socket.IO v4+: join is async — await so io.to(room) can deliver immediately after.
    if (myRoom) await socket.join(myRoom);
    if (process.env.NODE_ENV !== 'production') {
        const adapter = io.sockets.adapter;
        const n = adapter.rooms.get(myRoom)?.size ?? 0;
        console.log(`[socket] user ${socket.userId} joined ${myRoom} (room size ${n})`);
    }

    // Keepalive ping/pong to prevent Render free tier from closing idle connections
    socket.on('ping', () => socket.emit('pong'));

    // ── WebRTC call signalling ──────────────────────────────────────────────
    // All events are forwarded to the target user's room; the server never
    // inspects the SDP/ICE payloads — it is a pure relay.

    // Caller initiates: { to, offer (RTCSessionDescription), callType ('video'|'audio') }
    socket.on('call:offer', ({ to, offer, callType }) => {
        const room = userRoom(to);
        if (!room || !offer) return;
        const payload = {
            from: socket.userId,
            offer,
            callType: callType || 'video',
        };
        io.to(room).emit('call:offer', payload);
        if (process.env.NODE_ENV !== 'production') {
            const adapter = io.sockets.adapter;
            const n = adapter.rooms.get(room)?.size ?? 0;
            console.log(`[call:offer] from=${socket.userId} to=${to} room=${room} recipientsInRoom=${n}`);
        }
    });

    socket.on('call:answer', ({ to, answer }) => {
        const room = userRoom(to);
        if (!room || !answer) return;
        io.to(room).emit('call:answer', {
            from: socket.userId,
            answer,
        });
    });

    // ICE candidate exchange: { to, candidate }
    socket.on('call:ice-candidate', ({ to, candidate }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:ice-candidate', {
            from: socket.userId,
            candidate,
        });
    });

    // Either party ends the call: { to }
    socket.on('call:end', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:end', { from: socket.userId });
    });

    // Callee rejects the incoming call: { to }
    socket.on('call:reject', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:reject', { from: socket.userId });
    });

    // Caller cancels before callee answers: { to }
    socket.on('call:cancel', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:cancel', { from: socket.userId });
    });

    // Caller notifies callee of a missed call (timeout with no answer): { to }
    socket.on('call:missed', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:missed', { from: socket.userId });
    });
    // ───────────────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {});
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);
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

const messageRoutes = require('./src/routes/messageRoutes');
app.use('/api/messages', messageRoutes);

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

        // Start server (httpServer wraps app so socket.io works)
        httpServer.listen(PORT, () => {
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