/**
 * Test helpers – create users and JWTs for API integration tests.
 */
const jwt = require('jsonwebtoken');
const { User, Patient } = require('../src/models');

function uniqueEmail(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@example.com`;
}

/**
 * @param {object} opts
 * @param {'caregiver'|'patient'} [opts.userType]
 * @param {boolean} [opts.isEmailVerified]
 */
async function createUser(opts = {}) {
    const {
        userType = 'caregiver',
        isEmailVerified = true,
        password = 'TestPass123!',
        name = 'Test User',
        email: emailOpt,
    } = opts;
    const email = emailOpt || uniqueEmail(`ne-jest-${userType}`);
    return User.create({
        email,
        password,
        name,
        userType,
        isEmailVerified,
    });
}

async function createPatientWithProfile(patientProfile = {}) {
    const patientUser = await createUser({
        userType: 'patient',
        name: 'Jest Patient',
    });
    await Patient.create({
        userId: patientUser.id,
        locationConsent: false,
        ...patientProfile,
    });
    return patientUser;
}

function bearerToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET must be set in .env for tests');
    }
    return jwt.sign({ userId: user.id, userType: user.userType }, secret, { expiresIn: '1h' });
}

async function linkCaregiverToPatient(caregiver, patientUser) {
    await caregiver.addPatient(patientUser);
}

/**
 * Remove test data (order respects FKs).
 * @param {object} ids
 * @param {number[]} ids.patientUserIds
 * @param {number[]} ids.caregiverIds
 */
async function cleanupTestUsers(ids) {
    const { GameSession, Reminder, LocationLog, LocationAlert } = require('../src/models');
    const userIds = [...new Set([...(ids.patientUserIds || []), ...(ids.caregiverIds || [])])];
    if (userIds.length === 0) return;

    const pids = ids.patientUserIds || [];
    if (pids.length) {
        await LocationAlert.destroy({ where: { patientId: pids } });
        await LocationLog.destroy({ where: { patientId: pids } });
        await Reminder.destroy({ where: { patientId: pids } });
    }
    await GameSession.destroy({ where: { patientId: userIds } });

    for (const pid of ids.patientUserIds || []) {
        const p = await User.findByPk(pid);
        if (p) {
            const cgs = await p.getCaregivers();
            for (const cg of cgs) {
                await cg.removePatient(p);
            }
        }
    }

    await Patient.destroy({ where: { userId: ids.patientUserIds || [] } });
    await User.destroy({ where: { id: userIds } });
}

module.exports = {
    uniqueEmail,
    createUser,
    createPatientWithProfile,
    bearerToken,
    linkCaregiverToPatient,
    cleanupTestUsers,
};
