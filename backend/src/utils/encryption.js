/**
 * Field-level encryption for sensitive patient data.
 * Uses AES-256-GCM. Requires ENCRYPTION_KEY (32-byte hex) in .env.
 * If not configured, returns plaintext (for development/migration).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 64) return null;
  try {
    return Buffer.from(raw.slice(0, 64), 'hex');
  } catch {
    return null;
  }
}

/**
 * Encrypt a string. Returns base64(iv:authTag:ciphertext) or null if empty.
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const key = getKey();
  if (!key) return String(plaintext);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, enc]);
  return combined.toString('base64');
}

/**
 * Decrypt a string. Returns plaintext or null.
 */
function decrypt(ciphertext) {
  if (ciphertext == null || ciphertext === '') return null;
  const key = getKey();
  if (!key) return String(ciphertext);

  try {
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) return ciphertext;
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const enc = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return ciphertext;
  }
}

/**
 * Encrypt a number (e.g. lat/lng). Stored as encrypted string.
 */
function encryptNumber(n) {
  if (n == null || (typeof n === 'number' && isNaN(n))) return null;
  return encrypt(String(n));
}

/**
 * Decrypt a number.
 */
function decryptNumber(ciphertext) {
  const s = decrypt(ciphertext);
  if (s == null) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function isEncryptionEnabled() {
  return !!getKey();
}

/** Salt for email hash (optional). Uses ENCRYPTION_KEY if not set. */
function getEmailHashSalt() {
  return process.env.EMAIL_HASH_SALT || process.env.ENCRYPTION_KEY || 'neuroease-email-salt';
}

/**
 * Hash email for lookup (like password hash, but we need the actual email for sending).
 * Same input always produces same hash. Used for login/duplicate checks.
 */
function hashEmail(email) {
  if (email == null || String(email).trim() === '') return null;
  const normalized = String(email).trim().toLowerCase();
  const salt = getEmailHashSalt();
  return crypto.createHash('sha256').update(salt + normalized).digest('hex');
}

/** Sequelize getter for encrypted string field. */
function encryptedGetter(field) {
  return function () {
    const raw = this.getDataValue(field);
    return raw ? decrypt(raw) : null;
  };
}

/** Sequelize setter for encrypted string field. */
function encryptedSetter(field) {
  return function (value) {
    this.setDataValue(field, value != null && value !== '' ? encrypt(value) : null);
  };
}

/** Sequelize getter for encrypted number field. */
function encryptedNumberGetter(field) {
  return function () {
    const raw = this.getDataValue(field);
    return raw != null ? decryptNumber(raw) : null;
  };
}

/** Sequelize setter for encrypted number field. */
function encryptedNumberSetter(field) {
  return function (value) {
    this.setDataValue(field, value != null && !isNaN(value) ? encryptNumber(value) : null);
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptNumber,
  decryptNumber,
  isEncryptionEnabled,
  encryptedGetter,
  encryptedSetter,
  encryptedNumberGetter,
  encryptedNumberSetter,
  hashEmail,
};
