# NeuroEase Backend API Documentation

## 1. Overview
The NeuroEase backend is a RESTful API for the NeuroEase system. It provides:
- Secure authentication using JSON Web Tokens (JWT)
- Role-based access for **caregiver** and **patient**
- Caregiver–patient assignment with strict access isolation
- Patient lifecycle management using **archiving / unarchiving** (soft retention, not deletion)
- Reminder management with ownership enforcement

The backend is implemented using **Node.js (Express)** and **PostgreSQL** via **Sequelize ORM**.

**Automated tests:** Jest + Supertest integration tests for selected APIs (`npm test`); documented in **section 11**.

**Security testing:** dependency audits, checklist, OWASP mapping, and a sample dissertation paragraph — **`docs/SecurityTesting.md`**.

---

## 2. Technology Stack
- Node.js + Express (API server)
- PostgreSQL (database)
- Sequelize (ORM + associations)
- JWT (stateless authentication)
- bcrypt v6+ (password hashing via model hooks; avoids legacy native install chain flagged by earlier `npm audit`)
- Yup (request validation)
- morgan (HTTP request logging)
- cors + Express JSON body parsing
> Note: The project uses **Yup** for request validation (`src/middleware/validation.js`). Ensure it is installed and added to dependencies if missing:
```bash
npm install yup
````
---
## 3. Backend Structure (Key Files)
```

backend/
server.js
src/httpApp.js
tests/
setup.js
helpers.js
api.integration.test.js
jest.config.js
.env
package.json
src/
config/database.js
controllers/
authController.js
patientController.js
reminderController.js
middleware/
auth.js
roles.js
validation.js
models/
User.js
Patient.js
Reminder.js
GameSession.js
LocationLog.js
SafeZone.js
index.js
routes/
authRoutes.js
patientRoutes.js
reminderRoutes.js

````

---

## 4. Setup and Running

### 4.1 Install dependencies
```bash
cd backend
npm install
````

### 4.2 Environment variables

Create a `.env` file in `backend/` (example):

```env
PORT=5001
NODE_ENV=development
JWT_SECRET=replace_this_in_production
# PATIENT_JWT_EXPIRES=30d

DB_HOST=localhost
DB_PORT=5432
DB_NAME=neuroease_db
DB_USER=neuroease_user
DB_PASSWORD=neuroease_password

FRONTEND_URL=http://localhost:5173
PATIENT_APP_URL=http://localhost:5175
SMTP – required to send real emails. If unset, the link is only printed in the backend console (for local dev).
MAIL_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Optional: encrypt sensitive patient data at rest (see docs/DataEncryption.md)
# ENCRYPTION_KEY=<64-char hex from: openssl rand -hex 32>

```

### Email verification

New users get a verification link by email and must open it before they can log in.

- **FRONTEND_URL** – Base URL of the caregiver dashboard. The link in the email is `FRONTEND_URL/verify-email?token=...`. Use `http://localhost:5173` (not https) for local dev so the link works when clicked.
- **PATIENT_APP_URL** – Base URL of the patient app. Used in patient invite and magic-link emails (`PATIENT_APP_URL/activate?token=...` and `PATIENT_APP_URL/login?token=...`). Use `http://localhost:5175` for local dev.
- **SMTP** – Needed to actually send emails. If you don’t set it, the app still runs and the verification link is logged in the backend console on each signup (you can copy and open it). For real inbox delivery you must set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- Links expire after 24 hours; users can request a new one from the login page.

For implementation details on email verification and sending email with Node and React, see [7], [8].

**Web push (in-app reminder notifications)**  
When patients choose “In-app push” in the patient app Profile, the backend sends reminder notifications via the Web Push API. Set these in `.env` to enable push:

- `VAPID_PUBLIC_KEY` – Public key (base64url) for Web Push.
- `VAPID_PRIVATE_KEY` – Private key (base64url). Keep this secret.

Generate a key pair with: `npx web-push generate-vapid-keys`. If these are unset, the reminder job still runs but will not send in-app push (only email for “Email” preference). See docs/PatientApp.md for limitations (e.g. iOS 16.4+). If the server fails at startup with “column user_id of relation push_subscriptions contains null values”, the startup code will truncate the old `push_subscriptions` table once so the schema can be updated; just restart the server.

>  note: Create a database matching DB_NAME (example neuroease) using pgAdmin or CLI.

### 4.3 Start the server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```
Server starts on:

`http://localhost:<PORT>`

Health check:

* `GET /api/health`

### 4.4 Run automated API tests

```bash
npm test
```

See **section 11** for scope, prerequisites, and file layout.

### 4.5 Dependency audit (all packages)

From monorepo root:

```bash
npm run audit:all
```

Runs `npm audit` on `backend`, `patient-app`, `caregiver-dashboard`, and the root package. Interpretation and security-testing narrative: **`docs/SecurityTesting.md`**.

---

## 5. Database Initialisation

On startup the server:

1. tests the database connection (`sequelize.authenticate()`), then
2. synchronises tables using:

```js
sequelize.sync({ alter: true })
```

This supports iterative development without dropping tables. For production deployment, database migrations are recommended.

---

## 6. Authentication, Roles, and Data Isolation

### 6.1 JWT Authentication

After register/login, the API returns a JWT. Include it on protected requests:

```
Authorization: Bearer <TOKEN>
```

JWT payload includes:

* `userId`
* `userType` (`caregiver` or `patient`)

JWT expiry is set in the authentication controller: **caregiver** email+password login uses **7 days**; **patient** sessions (after invite activation or magic-link / short-code login) use **`PATIENT_JWT_EXPIRES`**, defaulting to **30 days**.

### 6.2 Session length: caregiver (7d) vs patient (30d default)

**Caregiver (7 days).** A one-week access token reduces repeated logins for dashboard workflows while keeping an upper bound on reuse. Session timeout choices should balance security and usability for the data handled [4]; JWTs must be rejected after `exp` [5], [6].

**Patient (30 days by default).** Patients authenticate **without a password** (email possession via time-limited magic link or invite). A longer **absolute** session reduces how often they must repeat that flow—important where extra authentication steps create **disproportionate burden** (older adults, cognitive impairment). WCAG 2.2 **3.3.8 Accessible Authentication (Minimum)** (Level AA) requires that cognitive function tests are not required for login [11]; while that criterion targets verification mechanics, the same **inclusive-design** principle supports avoiding unnecessarily short sessions that force frequent re-proof of email. General JWT operational guidance favours **short-lived access tokens** when paired with refresh or rotation [9]; here there is **no refresh token**: risk is partially offset by **HTTPS**, **bounded `exp`**, **client logout**, and the ability to **re-issue** a session only after a fresh magic link proves control of the mailbox. NIST’s digital-identity material discusses **session** behaviour in **authenticated** contexts and risk-appropriate controls [10].

Override patient duration in `.env` with `PATIENT_JWT_EXPIRES` (any `jsonwebtoken` `expiresIn` string accepted by the library, e.g. `45d`, `60d`).

### 6.3 Role-based access control (RBAC)

Role middleware is used to restrict endpoints:

* `requireCaregiver` (caregiver-only routes)
* `requireAny` (caregiver or patient)

### 6.4 Ownership and isolation rules

The API enforces:

* A **patient** can only access their own record and reminders.
* A **caregiver** can only access patients/reminders for patients assigned to them via the caregiver–patient relationship.

This ensures each caregiver only processes data for their assigned patients.

---

## 7. Data Model Summary

### 7.1 Users (caregivers + patients)

A single `users` table stores both account types, differentiated by `userType`.

Archiving metadata is stored on the user record:

* `isArchived`
* `archivedAt`, `archivedBy`, `archiveReason`, `archiveNotes`
* `unarchivedAt`, `unarchivedBy`, `unarchiveNotes`

### 7.2 Patient profile

A `Patient` profile is linked to the patient user (`userId`) and stores:

* `dateOfBirth`
* `emergencyContact`
* `medicalConditions`

### 7.3 Caregiver–patient assignment

Caregiver–patient assignment is modelled as a many-to-many relationship through:

* `caregiver_patients`

### 7.4 Reminders

Reminders are linked to a patient (`patientId`) and include:

* `title`, `message`
* `reminderType`: `medication | appointment | general`
* `scheduledTime`
* `recurrence`: `once | daily | weekly`
* `isCompleted` (default false)

---

## 8. API Endpoints

### 8.1 Health

**GET** `/api/health`
Returns runtime status metadata.

---

### 8.2 Auth (`/api/auth`)

#### POST `/register` (public)

Registers a new user (caregiver or patient). Validated using Yup.

#### POST `/login` (public)

Authenticates a user and returns a JWT.

#### GET `/profile` (protected)

Returns the authenticated user profile (password excluded).

#### POST `/logout` (protected)

Stateless logout (returns success). No server-side token revocation is implemented.

---

### 8.3 Patients (`/api/patients`) (all protected)

#### POST `/assign` (caregiver only)

Assigns an existing patient to the current caregiver by patient email.

#### POST `/` (caregiver only)

Creates a new patient account + patient profile, and auto-assigns to the creating caregiver.
Validated using Yup.

#### GET `/` (caregiver only)

Returns active (non-archived) patients assigned to the caregiver.

#### PUT `/:id` (caregiver or patient)

Updates patient identity/profile fields. Ownership rules apply.
Archived patients cannot be updated.

#### DELETE `/:id` (caregiver only)

Removes the caregiver–patient assignment (does not delete the patient account).

#### POST `/:id/restore` (caregiver only)

Restores a previously removed assignment to the caregiver.

#### POST `/:id/archive` (caregiver only)

Archives an assigned patient (soft retention). Requires:

* `archiveReason` ∈ `discharged | transferred | deceased | inactive | other`
* optional `notes`

#### POST `/:id/unarchive` (caregiver only)

Unarchives a patient and reassigns them to the caregiver who performed the action.
Optional `notes` supported.

#### GET `/archived` (caregiver only)

Returns archived patients assigned to the caregiver. Optional query filters:

* `reason`
* `startDate`
* `endDate`

#### GET `/archive-audit` (caregiver only)

Returns an audit-style view of archive/unarchive status for patients assigned to the caregiver.

#### GET `/:patientId` (caregiver or patient)

Returns patient details with ownership checks:

* patient can only retrieve themselves
* caregiver must be assigned
* caregivers cannot access archived patients

---

### 8.4 Reminders (`/api/reminders`) (all protected)

Ownership is enforced inside the reminder controller:

* patients can only manage reminders for themselves
* caregivers can only manage reminders for assigned patients

#### POST `/`

Creates a reminder (validated using Yup).

#### GET `/patient/:patientId`

Returns reminders for a given patient (ownership enforced).

#### PUT `/:id`

Updates a reminder by reminder ID (ownership enforced).

#### DELETE `/:id`

Deletes a reminder by reminder ID (ownership enforced).

---

## 9. Design Rationale: Archiving for UK Records Retention

### 9.1 Why archiving is used instead of deletion

In UK health and care contexts, patient information often needs to be retained for governance, clinical accountability, and continuity [3]. At the same time, the UK GDPR storage limitation principle requires that personal data is kept **no longer than necessary** for its purpose, while allowing longer storage where justified (e.g., for archiving purposes) under appropriate safeguards [1]. NHS guidance also indicates that many health and care records are generally retained for extended periods (commonly around eight years after last treatment, depending on record type and context) [2].

For NeuroEase, these constraints shaped the backend design: instead of deleting patient accounts and losing traceability, the system supports a controlled archive lifecycle.

### 9.2 How the archive lifecycle is implemented

Archiving is implemented as a reversible state change:

* `isArchived` is set to true (soft-archive), rather than deleting the record
* audit metadata is recorded (`archivedAt`, `archivedBy`, `archiveReason`, optional notes)
* archived patients are excluded from active patient lists
* caregivers are blocked from accessing archived patient details through standard endpoints
* unarchiving clears archive fields, records unarchive metadata, and restores assignment

This supports retention needs while reducing routine processing and operational visibility of inactive records.

---

## 10. Error Handling and Logging

* HTTP requests are logged using `morgan('combined')`.
* Unknown routes return:

```json
{ "success": false, "message": "API endpoint not found" }
```

* A global error handler returns HTTP 500 for unhandled exceptions.

---

## 11. Automated API testing (Jest + Supertest)

Integration tests exercise the **real Express app** and **real PostgreSQL** (same database as your `.env` connection). They create temporary users, call HTTP endpoints, then **delete** those users and related rows (reminders, game sessions, location logs/alerts, caregiver links).

### 11.1 Prerequisites

- Dependencies installed: `cd backend && npm install`
- `.env` configured, including a working DB and **`JWT_SECRET`**
- PostgreSQL reachable when you run tests

### 11.2 How to run

```bash
cd backend
npm test
```

This sets `NODE_ENV=test`, runs **Jest** in band (`--runInBand`) to avoid parallel clashes on one database, and loads `.env` via `tests/setup.js`.

### 11.3 What is covered

The suite in `backend/tests/api.integration.test.js` currently checks:

| Area | Behaviour verified |
|------|-------------------|
| **POST `/api/auth/login`** | `401` wrong password; `200` + JWT for verified caregiver |
| **GET `/api/patients/:patientId`** | `401` without token; `200` own profile; `403` other patient’s profile |
| **GET `/api/reminders/patient/:patientId`** | `200` patient can list own reminders |
| **POST `/api/games`** | `401` no token; `403` caregiver; `400` invalid `gameType`; `201` patient saves session (incl. adaptive difficulty fields) |
| **POST `/api/location/patient/update`** | `201` when consent on and not paused; `403` when **`locationPausedUntil`** is in the future |
| **GET `/api/health`** | `200` |

Helper factories and teardown live in `backend/tests/helpers.js`.

### 11.4 Code layout (tests vs server)

- **`backend/src/httpApp.js`** – builds the Express app (middleware + all `/api/*` routes + 404/error handlers). Used by Jest so tests do **not** open a TCP port or Socket.IO.
- **`backend/server.js`** – calls `createHttpApp()`, attaches **Socket.IO** to the HTTP server, runs Sequelize sync, then `listen()`.

### 11.5 What is not automated here

Messages, push (VAPID), email, WebRTC signalling, and full CRUD on every caregiver route are **not** part of this suite. They would need extra fixtures/mocks or E2E/browser tests. For the thesis you can describe this file as **targeted API regression tests** for auth, access control, reminders list, games persistence, and location pause behaviour.

**Security testing in detail** (`npm audit`, residual findings, manual/design controls, OWASP mapping, suggested dissertation paragraph): **`docs/SecurityTesting.md`**.

---

## References (IEEE)

[1] Information Commissioner’s Office (ICO), “Principle (e): Storage limitation,” ICO. [Online]. Available: [https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/). Accessed: Dec. 22, 2025.

[2] NHS England, “Records Management Code of Practice,” NHS England (Transformation Directorate), Dec. 5, 2023. [Online]. Available: [https://transform.england.nhs.uk/information-governance/guidance/records-management-code/](https://transform.england.nhs.uk/information-governance/guidance/records-management-code/). Accessed: Dec. 22, 2025.

[3] NHSX, “Records Management Code of Practice for Health and Social Care 2021 (Version 7),” NHS England, 2021. [Online]. Available: [https://transform.england.nhs.uk/media/documents/NHSX_Records_Management_CoP_V7.pdf](https://transform.england.nhs.uk/media/documents/NHSX_Records_Management_CoP_V7.pdf). Accessed: Dec. 22, 2025.

[4] OWASP, “Session Management Cheat Sheet,” OWASP Cheat Sheet Series. [Online]. Available: [https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Accessed: Dec. 22, 2025.

[5] M. Jones, J. Bradley, and N. Sakimura, “JSON Web Token (JWT),” RFC 7519, IETF, May 2015. [Online]. Available: [https://datatracker.ietf.org/doc/html/rfc7519](https://datatracker.ietf.org/doc/html/rfc7519). Accessed: Dec. 22, 2025.

[6] OWASP, “Testing JSON Web Tokens,” OWASP Web Security Testing Guide. [Online]. Available: [https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens). Accessed: Dec. 22, 2025.

[7] “Building an email verification and notification feature in React + Node.js apps,” Medium. [Online]. Available: https://medium.com/@python-javascript-php-html-css/building-an-email-verification-and-notification-feature-in-react-node-js-apps-53f372006fc5. [Accessed: Feb. 12, 2026].

[8] D. Ozokoye, “How to send emails with React using Nodemailer,” SendLayer Blog, Dec. 16, 2025. [Online]. Available: https://sendlayer.com/blog/how-to-send-emails-with-react/. [Accessed: Feb. 12, 2026].

[9] M. Jones, J. Sakimura, and J. Bradley, “JSON Web Token Best Current Practices,” RFC 8725, IETF, Feb. 2020. [Online]. Available: [https://datatracker.ietf.org/doc/html/rfc8725](https://datatracker.ietf.org/doc/html/rfc8725). Accessed: Apr. 6, 2026.

[10] NIST, *Digital Identity Guidelines*, SP 800-63B, NIST, Aug. 2022. [Online]. Available: [https://pages.nist.gov/800-63-3/sp800-63b.html](https://pages.nist.gov/800-63-3/sp800-63b.html). Accessed: Apr. 6, 2026.

[11] W3C Web Accessibility Initiative, “Understanding Success Criterion 3.3.8: Accessible Authentication (Minimum),” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: [https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html). Accessed: Apr. 6, 2026.

