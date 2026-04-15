/**
 * NeuroEase Backend – Express server entry point.
 * Mounts API routes, connects to PostgreSQL via Sequelize, and handles 404/500.
 * Environment: .env (PORT, DB_*, JWT_SECRET, SMTP_*, PATIENT_APP_URL, FRONTEND_URL).
 */
require('dotenv').config();

// Force IPv4 for SMTP – Render free tier has no IPv6 outbound; Gmail resolves to both
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const jwt = require('jsonwebtoken');

const { createHttpApp, corsOriginCallback } = require('./src/httpApp');
const { sequelize } = require('./src/models');
const {
    storePendingOffer,
    getPendingOfferForCallee,
    clearPendingForCallee,
    notifyIncomingCallViaPush,
} = require('./src/utils/callIncoming');
const { startReminderEmailJob } = require('./src/jobs/reminderEmailJob');

const app = createHttpApp();
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
        console.warn('[EMAIL] RESEND_API_KEY is not set but SMTP_* is.');
    } else if (hasSmtp) {
        console.log('[EMAIL] Using SMTP only (no RESEND_API_KEY).');
    }
}

// Socket.io – attach to the http server, same CORS policy.
// Longer pingTimeout helps mobile networks + Render’s edge (default 20s is aggressive).
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: corsOriginCallback,
        credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 50_000,
    connectTimeout: 45_000,
    transports: ['polling', 'websocket'],
});

// Authenticate socket connections with the same JWT used for the REST API
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
    if (myRoom) await socket.join(myRoom);

    const replay = getPendingOfferForCallee(socket.userId);
    if (replay) {
        socket.emit('call:offer', {
            from: replay.from,
            offer: replay.offer,
            callType: replay.callType,
        });
    }

    if (process.env.NODE_ENV !== 'production') {
        const adapter = io.sockets.adapter;
        const n = adapter.rooms.get(myRoom)?.size ?? 0;
        console.log(`[socket] user ${socket.userId} joined ${myRoom} (room size ${n})`);
    }

    socket.on('ping', () => socket.emit('pong'));

    socket.on('call:offer', ({ to, offer, callType }) => {
        const room = userRoom(to);
        if (!room || !offer) return;
        const ct = callType || 'video';
        const payload = {
            from: socket.userId,
            offer,
            callType: ct,
        };
        storePendingOffer(to, payload);
        io.to(room).emit('call:offer', payload);
        void notifyIncomingCallViaPush({
            calleeUserId: to,
            fromUserId: socket.userId,
            callType: ct,
        });
        if (process.env.NODE_ENV !== 'production') {
            const adapter = io.sockets.adapter;
            const roomN = adapter.rooms.get(room)?.size ?? 0;
            console.log(`[call:offer] from=${socket.userId} to=${to} room=${room} recipientsInRoom=${roomN}`);
        }
    });

    socket.on('call:answer', ({ to, answer }) => {
        const room = userRoom(to);
        if (!room || !answer) return;
        clearPendingForCallee(socket.userId);
        io.to(room).emit('call:answer', {
            from: socket.userId,
            answer,
        });
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
        const room = userRoom(to);
        if (!room) return;
        io.to(room).emit('call:ice-candidate', {
            from: socket.userId,
            candidate,
        });
    });

    socket.on('call:end', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        clearPendingForCallee(to);
        clearPendingForCallee(socket.userId);
        io.to(room).emit('call:end', { from: socket.userId });
    });

    socket.on('call:reject', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        clearPendingForCallee(socket.userId);
        io.to(room).emit('call:reject', { from: socket.userId });
    });

    socket.on('call:cancel', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        clearPendingForCallee(to);
        io.to(room).emit('call:cancel', { from: socket.userId });
    });

    socket.on('call:missed', ({ to }) => {
        const room = userRoom(to);
        if (!room) return;
        clearPendingForCallee(to);
        io.to(room).emit('call:missed', { from: socket.userId });
    });

    socket.on('disconnect', () => {});
});

app.set('io', io);

// Connect to DB, sync models (create/alter tables), then listen
const startServer = async () => {
    try {
        console.log('Testing database connection...');
        await sequelize.authenticate();
        console.log('PostgreSQL connection established successfully');

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

        console.log('Syncing database tables...');
        await sequelize.sync({ alter: true });
        console.log('Database tables synchronized');

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
