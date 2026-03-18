# Patient Data Encryption

NeuroEase encrypts sensitive patient data at rest when an encryption key is configured. This helps meet security and privacy requirements for healthcare applications.

## Overview

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Scope**: Field-level encryption for sensitive columns
- **Key**: 32-byte key from `ENCRYPTION_KEY` in `.env`

## Legal & Regulatory Rationale

Encryption of these fields supports compliance with:

| Framework | Relevance |
|-----------|-----------|
| **HIPAA** (US) | The Security Rule requires “addressable” safeguards for electronic Protected Health Information (ePHI) [1][2]. Encryption is functionally mandatory for ePHI at rest; AES-256 is the standard. If ePHI is encrypted and keys are not compromised, breach notification may not be required [3]. |
| **GDPR** (EU/UK) | Article 32 requires “appropriate technical measures” for personal data security. Encryption is explicitly listed [4]. Health data and data on sex life/sexual orientation are “special categories” (Art. 9) requiring stronger protection [5]. |
| **UK Data Protection Act 2018** | Implements GDPR in UK law; health data is “special category” data requiring appropriate safeguards [6]. |

**Why these fields are encrypted:**

- **PII (personally identifiable information)**: Name, address, phone, email-related identifiers, date of birth, gender — used to identify individuals; required to be protected under GDPR and similar laws [4].
- **PHI/ePHI (protected health information)**: Medical conditions, medical history, care notes, cognitive scores — health-related data; core HIPAA scope [1][2] and GDPR special categories [5].
- **Location data**: Coordinates, safe zones — can reveal habits, home, and movements; sensitive under GDPR and often treated as high-risk [4].
- **Archive/audit notes**: Archive reason and notes — may describe health status, family circumstances, or other sensitive context.

**Fields not encrypted:**

- **IDs, timestamps, booleans**: Not directly identifying; low risk; used for queries and logic.

**Email (hybrid approach):** Email is encrypted at rest. Login uses a SHA-256 hash (`email_hash`) for lookup (like password comparison): the user enters their email, we hash it and find the user by `email_hash`; the stored email is decrypted only when needed for display or sending.

## Encrypted Fields

| Model | Fields | Rationale |
|-------|--------|------------|
| **User** | `email`, `name`, `archiveReason`, `archiveNotes`, `unarchiveNotes` | PII; email encrypted; lookup via `email_hash` |
| **Patient** | `dateOfBirth`, `gender`, `address`, `phoneNumber`, `preferredCommunication`, `careNotes`, `emergencyContact*`, `medicalConditions`, `medicalHistory` | PII; PHI; special categories (health, identifiers) |
| **LocationLog** | `latitude`, `longitude` | Location data; high sensitivity |
| **LocationAlert** | `latitude`, `longitude` | Location data |
| **SafeZone** | `name`, `centerLat`, `centerLng` | Location data |
| **Reminder** | `title`, `message` | May contain health-related content |
| **GameSession** | `gameType`, `score`, `duration`, `accuracy` | Cognitive performance; health-related |

## Setup

### 1. Generate an encryption key

```bash
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6...` (64 hex characters = 32 bytes)

### 2. Add to `.env`

```env
ENCRYPTION_KEY=your_64_character_hex_key_here
```

### 3. Restart the backend

Encryption is applied automatically when the key is present. If `ENCRYPTION_KEY` is not set or invalid, data is stored and returned as plaintext (for development or migration).

## Encrypting existing data

If you had data before enabling encryption, it remains plaintext. Run the migration once:

```bash
cd backend
npm run encrypt-existing
```

This re-saves each record so the encryption setters run. Safe to run multiple times.

## Behaviour

- **Write**: Values are encrypted before being stored in the database.
- **Read**: Values are decrypted when loaded from the database.
- **Backward compatibility**: If decryption fails (e.g. legacy plaintext data), the original value is returned.
- **Column types**: Encrypted fields use `TEXT` columns to store ciphertext. On first run with encryption enabled, `sync({ alter: true })` will alter existing columns if needed.

## Security Notes

- **Key management**: Store `ENCRYPTION_KEY` securely. Rotating the key requires re-encrypting existing data.
- **HTTPS**: Encryption at rest complements TLS in transit. Use HTTPS in production.
- **Email**: Stored encrypted; lookup uses `email_hash` (SHA-256 of normalized email). Optional `EMAIL_HASH_SALT` in `.env` adds entropy; defaults to `ENCRYPTION_KEY` if unset.

---

## References

1. U.S. Department of Health and Human Services. *Is the use of encryption mandatory in the Security Rule?* HIPAA for Professionals. [https://www.hhs.gov/hipaa/for-professionals/faq/2001/is-the-use-of-encryption-mandatory-in-the-security-rule/index.html](https://www.hhs.gov/hipaa/for-professionals/faq/2001/is-the-use-of-encryption-mandatory-in-the-security-rule/index.html)

2. U.S. Code of Federal Regulations. 45 CFR § 164.312(a)(2)(iv) and § 164.312(e)(2)(ii) — Technical safeguards for ePHI. [https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312)

3. U.S. Department of Health and Human Services. *Guidance to Render Unsecured Protected Health Information Unusable, Unreadable, or Indecipherable to Unauthorized Individuals.* Breach Notification Rule. [https://www.hhs.gov/hipaa/for-professionals/breach-notification/guidance/index.html](https://www.hhs.gov/hipaa/for-professionals/breach-notification/guidance/index.html)

4. European Union. Regulation (EU) 2016/679 (GDPR). *Article 32 — Security of processing.* [https://gdpr-info.eu/art-32-gdpr/](https://gdpr-info.eu/art-32-gdpr/)

5. European Union. Regulation (EU) 2016/679 (GDPR). *Article 9 — Processing of special categories of personal data.* [https://gdpr-info.eu/art-9-gdpr/](https://gdpr-info.eu/art-9-gdpr/)

6. UK Information Commissioner's Office. *Special category data.* GDPR guidance. [https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)
