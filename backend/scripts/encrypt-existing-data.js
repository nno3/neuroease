#!/usr/bin/env node
/**
 * One-time migration: encrypt existing plaintext data in the database.
 * Run from backend/: node scripts/encrypt-existing-data.js
 *
 * Requires ENCRYPTION_KEY in .env. Re-saves each record to trigger encryption.
 * Safe to run multiple times (already-encrypted data is decrypted then re-encrypted).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { isEncryptionEnabled } = require('../src/utils/encryption');
const { User, Patient, LocationLog, LocationAlert, SafeZone, Reminder, GameSession } = require('../src/models');

async function encryptUsers() {
  const users = await User.findAll();
  for (const u of users) {
    const updates = {};
    if (u.email) updates.email = u.email;
    if (u.name) updates.name = u.name;
    if (u.archiveReason != null) updates.archiveReason = u.archiveReason;
    if (u.archiveNotes != null) updates.archiveNotes = u.archiveNotes;
    if (u.unarchiveNotes != null) updates.unarchiveNotes = u.unarchiveNotes;
    if (Object.keys(updates).length > 0) await u.update(updates);
  }
  return users.length;
}

async function encryptPatients() {
  const patients = await Patient.findAll();
  const fields = ['address', 'phoneNumber', 'careNotes', 'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone', 'emergencyContact', 'medicalConditions', 'medicalHistory', 'dateOfBirth', 'gender', 'preferredCommunication'];
  for (const p of patients) {
    const updates = {};
    for (const f of fields) {
      const val = p.get(f);
      if (val != null && val !== '') updates[f] = val;
    }
    if (Object.keys(updates).length > 0) await p.update(updates);
  }
  return patients.length;
}

async function encryptLocationLogs() {
  const logs = await LocationLog.findAll();
  for (const l of logs) {
    const lat = l.latitude;
    const lng = l.longitude;
    if (lat != null && lng != null) await l.update({ latitude: lat, longitude: lng });
  }
  return logs.length;
}

async function encryptLocationAlerts() {
  const alerts = await LocationAlert.findAll();
  for (const a of alerts) {
    const lat = a.latitude;
    const lng = a.longitude;
    if (lat != null && lng != null) await a.update({ latitude: lat, longitude: lng });
  }
  return alerts.length;
}

async function encryptSafeZones() {
  const zones = await SafeZone.findAll();
  for (const z of zones) {
    const updates = {};
    if (z.name) updates.name = z.name;
    if (z.centerLat != null) updates.centerLat = z.centerLat;
    if (z.centerLng != null) updates.centerLng = z.centerLng;
    if (Object.keys(updates).length > 0) await z.update(updates);
  }
  return zones.length;
}

async function encryptReminders() {
  const reminders = await Reminder.findAll();
  for (const r of reminders) {
    await r.update({ title: r.title, message: r.message });
  }
  return reminders.length;
}

async function encryptGameSessions() {
  const sessions = await GameSession.findAll();
  for (const s of sessions) {
    const updates = { gameType: s.gameType, score: s.score, duration: s.duration };
    if (s.accuracy != null) updates.accuracy = s.accuracy;
    await s.update(updates);
  }
  return sessions.length;
}

async function main() {
  if (!isEncryptionEnabled()) {
    console.error('ENCRYPTION_KEY is not set or invalid. Add a 64-char hex key to .env');
    process.exit(1);
  }

  console.log('Encrypting existing plaintext data...');

  const [users, patients, locationLogs, locationAlerts, safeZones, reminders, gameSessions] = await Promise.all([
    encryptUsers(),
    encryptPatients(),
    encryptLocationLogs(),
    encryptLocationAlerts(),
    encryptSafeZones(),
    encryptReminders(),
    encryptGameSessions(),
  ]);

  console.log('Done:');
  console.log('  Users:', users);
  console.log('  Patients:', patients);
  console.log('  LocationLogs:', locationLogs);
  console.log('  LocationAlerts:', locationAlerts);
  console.log('  SafeZones:', safeZones);
  console.log('  Reminders:', reminders);
  console.log('  GameSessions:', gameSessions);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
