/**
 * HTTP API integration tests (Supertest + real PostgreSQL from .env).
 * Run: npm test   (requires DB reachable and JWT_SECRET set)
 */
const request = require('supertest');
const { sequelize } = require('../src/models');
const { createHttpApp } = require('../src/httpApp');
const {
    createUser,
    createPatientWithProfile,
    bearerToken,
    linkCaregiverToPatient,
    cleanupTestUsers,
} = require('./helpers');
const {
    routesRequireAuth401,
    publicRoutesSmoke,
    caregiverOnly403,
    patientOnly403,
} = require('./routeManifest');

const app = createHttpApp();

/** @param {string} method @param {string} path @param {{ query?: object, send?: object }} [opts] */
function buildRequest(method, path, opts = {}) {
    const m = method.toLowerCase();
    let chain = request(app)[m](path);
    if (opts.query) chain = chain.query(opts.query);
    if (opts.send !== undefined) chain = chain.send(opts.send);
    return chain;
}

describe('NeuroEase API', () => {
    /** @type {number[]} */
    const caregiverIds = [];
    /** @type {number[]} */
    const patientUserIds = [];

    let caregiver;
    let patientA;
    let patientB;

    beforeAll(async () => {
        await sequelize.authenticate();

        caregiver = await createUser({ userType: 'caregiver', name: 'Jest Caregiver' });
        patientA = await createPatientWithProfile();
        patientB = await createPatientWithProfile();
        await linkCaregiverToPatient(caregiver, patientA);

        caregiverIds.push(caregiver.id);
        patientUserIds.push(patientA.id, patientB.id);
    });

    afterAll(async () => {
        await cleanupTestUsers({ caregiverIds, patientUserIds });
        await sequelize.close();
    });

    describe('POST /api/auth/login', () => {
        it('returns 401 for invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: caregiver.email, password: 'WrongPass999!' });
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('returns 200 and JWT for verified caregiver', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: caregiver.email, password: 'TestPass123!' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data?.token).toBeTruthy();
            expect(res.body.data?.user?.userType).toBe('caregiver');
        });
    });

    describe('GET /api/patients/:patientId', () => {
        it('returns 401 without Authorization header', async () => {
            const res = await request(app).get(`/api/patients/${patientA.id}`);
            expect(res.status).toBe(401);
        });

        it('returns 200 when patient reads own profile', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientA.id}`)
                .set('Authorization', `Bearer ${bearerToken(patientA)}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data?.patient?.id).toBe(patientA.id);
        });

        it('returns 403 when patient reads another patient profile', async () => {
            const res = await request(app)
                .get(`/api/patients/${patientB.id}`)
                .set('Authorization', `Bearer ${bearerToken(patientA)}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/reminders/patient/:patientId', () => {
        it('returns 200 for patient viewing own reminders list', async () => {
            const res = await request(app)
                .get(`/api/reminders/patient/${patientA.id}`)
                .set('Authorization', `Bearer ${bearerToken(patientA)}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('POST /api/games', () => {
        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/games').send({
                gameType: 'math',
                score: 1,
                duration: 10,
            });
            expect(res.status).toBe(401);
        });

        it('returns 403 for caregiver token', async () => {
            const res = await request(app)
                .post('/api/games')
                .set('Authorization', `Bearer ${bearerToken(caregiver)}`)
                .send({
                    gameType: 'math',
                    score: 1,
                    duration: 10,
                    maxScore: 2,
                    difficulty: 'normal',
                });
            expect(res.status).toBe(403);
        });

        it('returns 400 for invalid gameType', async () => {
            const res = await request(app)
                .post('/api/games')
                .set('Authorization', `Bearer ${bearerToken(patientA)}`)
                .send({
                    gameType: 'chess',
                    score: 0,
                    duration: 1,
                });
            expect(res.status).toBe(400);
        });

        it('returns 201 and saves session for patient', async () => {
            const res = await request(app)
                .post('/api/games')
                .set('Authorization', `Bearer ${bearerToken(patientA)}`)
                .send({
                    gameType: 'math',
                    score: 3,
                    duration: 45,
                    maxScore: 5,
                    difficulty: 'normal',
                    effectiveDifficulty: 'hard',
                });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data?.gameType).toBe('math');
            expect(res.body.data?.score).toBe(3);
        });
    });

    describe('POST /api/location/patient/update', () => {
        it('returns 403 when sharing is paused (consent still on)', async () => {
            const token = bearerToken(patientB);
            await request(app)
                .put(`/api/patients/${patientB.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ locationConsent: true });

            const ok = await request(app)
                .post('/api/location/patient/update')
                .set('Authorization', `Bearer ${token}`)
                .send({ latitude: 51.5, longitude: -0.12 });
            expect(ok.status).toBe(201);

            await request(app)
                .put(`/api/patients/${patientB.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    locationPausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                });

            const blocked = await request(app)
                .post('/api/location/patient/update')
                .set('Authorization', `Bearer ${token}`)
                .send({ latitude: 51.51, longitude: -0.13 });
            expect(blocked.status).toBe(403);
            expect(blocked.body.message).toMatch(/paused/i);

            await request(app)
                .put(`/api/patients/${patientB.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ locationPausedUntil: null, locationConsent: false });
        });
    });

    describe('GET /api/health', () => {
        it('returns 200', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Route manifest: every protected route returns 401 without Authorization', () => {
        const routes = routesRequireAuth401();
        routes.forEach((r) => {
            it(`${r.method.toUpperCase()} ${r.path}`, async () => {
                const res = await buildRequest(r.method, r.path, { query: r.query, send: r.send });
                expect(res.status).toBe(401);
                expect(res.body.success).toBe(false);
            });
        });
    });

    describe('Route manifest: public routes do not return 401 for missing Bearer token', () => {
        publicRoutesSmoke().forEach((r) => {
            it(`${r.method.toUpperCase()} ${r.path}`, async () => {
                const res = await buildRequest(r.method, r.path, { query: r.query, send: r.send });
                expect(res.status).not.toBe(401);
            });
        });
    });

    describe('Route manifest: caregiver-only routes return 403 for patient JWT', () => {
        caregiverOnly403().forEach((r) => {
            it(`${r.method.toUpperCase()} ${r.path}`, async () => {
                const res = await buildRequest(r.method, r.path, { query: r.query, send: r.send }).set(
                    'Authorization',
                    `Bearer ${bearerToken(patientA)}`
                );
                expect(res.status).toBe(403);
                expect(res.body.success).toBe(false);
            });
        });
    });

    describe('Route manifest: patient-only routes return 403 for caregiver JWT', () => {
        patientOnly403().forEach((r) => {
            it(`${r.method.toUpperCase()} ${r.path}`, async () => {
                const res = await buildRequest(r.method, r.path, { query: r.query, send: r.send }).set(
                    'Authorization',
                    `Bearer ${bearerToken(caregiver)}`
                );
                expect(res.status).toBe(403);
                expect(res.body.success).toBe(false);
            });
        });
    });
});
