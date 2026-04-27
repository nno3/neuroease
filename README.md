# NeuroEase

NeuroEase is a web-based system that helps people living with **mild cognitive impairment or dementia** and their **caregivers** stay coordinated in daily life. It combines a **caregiver dashboard** (web), a **patient-facing progressive web app** (PWA), and a **shared API** and database. The software supports reminders, **activity** visibility, **location** and **safe zone** awareness, **cognitive games**, **messaging** and **meeting** requests, **push** notifications, and **WebRTC** voice and video **calls**—all behind **role-based access** and **caregiver–patient assignment**.

**Scope:** NeuroEase is a **care coordination** tool, not a medical device and not a substitute for professional clinical care or emergency services.

This repository is a **monorepo** with three deployable applications and extensive documentation under `docs/`.

---

## Repository layout

| Path | Description |
|------|-------------|
| `backend/` | Node.js **Express** API, **Socket.IO** for realtime events, **PostgreSQL** via **Sequelize**, **JWT** auth, **Jest** integration tests |
| `caregiver-dashboard/` | **React** + **Vite** SPA for caregivers (patients, reminders, activity, maps, messages, settings, **calls**) |
| `patient-app/` | **React** + **Vite** PWA for patients (reminders, profile, **games**, **messages**, **calls**, **accessibility** options); optional **Capacitor** targets for native builds |
| `docs/` | Technical documentation: setup, architecture, and feature design notes |
| `DoD.md` | Definition of Done used for project governance |
| `PROJECTLOG.md` | Development and activity log |

---

## Technology overview

- **Runtime:** Node.js 18 or newer (see `engines` in the root `package.json`)
- **API:** Express, REST JSON under `/api`, health check at `GET /api/health`
- **Realtime:** Socket.IO (e.g. messaging, call signalling)
- **Data:** PostgreSQL, Sequelize ORM, encrypted fields for sensitive content where implemented
- **Auth:** JWT, bcrypt, role separation (`caregiver` / `patient`)
- **Validation:** Yup
- **Email / transactional mail:** Resend API (`RESEND_API_KEY`, `MAIL_FROM`); see `docs/Email-and-Resend.md`
- **Push:** Web Push (VAPID) for supported browsers
- **Frontends:** React 19, Vite, React Router, shared patterns for API access via **dev proxies** to the backend
- **Maps:** Leaflet (caregiver location views where enabled)
- **Tests:** Jest + Supertest in `backend/` (`npm test`)

---

## Local development

### Prerequisites

- **Node.js** 18+ and **npm**
- **PostgreSQL** (local or remote instance) and a database user with rights to create/use a dedicated database
- (Optional) **`RESEND_API_KEY`** and **`MAIL_FROM`** for transactional email; without them, verification links may be printed to the **backend** console in development

### 1. Database

Create a PostgreSQL database and user matching the values you will set in the backend `.env` file. The **BackendSetUp** guide describes the expected schema and migration flow.

### 2. Backend environment

In `backend/`, add a `.env` file. At minimum, set the database host, name, user, and password to match the PostgreSQL instance you created, set `PORT` to `5001` (or another port, consistently across all three apps), and set `JWT_SECRET` to a long, random, non-default string. Point `FRONTEND_URL` and `PATIENT_APP_URL` at the Vite dev URLs in the table below when running locally. The full variable list, optional encryption keys, and **Resend** email settings are specified in `docs/BackendSetUp.md` and `docs/Email-and-Resend.md`. If **`RESEND_API_KEY`** is not set, the API still runs and verification links may be printed in the **backend** console for local use.

### 3. Install and run

From the **repository root**:

```bash
npm install
cd backend && npm install && cd ..
cd caregiver-dashboard && npm install && cd ..
cd patient-app && npm install && cd ..
```

**Backend (terminal 1):**

```bash
cd backend
npm run dev
```

**Caregiver dashboard (terminal 2):**

```bash
cd caregiver-dashboard
npm run dev
```

**Patient PWA (terminal 3):**

```bash
cd patient-app
npm run dev
```

**Run all three at once (from the repository root, after `npm install` at root for `concurrently` ):**

```bash
npm run dev:all
```

**Default local URLs**

| Service | URL |
|---------|-----|
| API | `http://localhost:5001` (for example `http://localhost:5001/api/health`) |
| Caregiver app (Vite) | `http://localhost:5173` — proxies `/api` and `/socket.io` to port **5001** |
| Patient app (Vite) | `http://localhost:5175` — same proxy pattern |

**HTTPS in development** (useful for mobile camera, microphone, or PWA features that require a secure context): for each frontend, use the `dev:https` script and set `VITE_DEV_HTTPS=1` as defined in the respective `package.json` and Vite config.

### 4. Automated API tests

```bash
cd backend
npm test
```

---

## Hosted deployment (Render)

When the project is deployed on [Render](https://render.com), you can open the public frontends without running anything locally:

| App | URL |
|-----|-----|
| Caregiver dashboard | [neuroease-dashboard.onrender.com](https://neuroease-dashboard.onrender.com/) |
| Patient PWA | [neuroease-patient.onrender.com](https://neuroease-patient.onrender.com/) |

The API runs as its own service; the built apps are configured at build time to call that backend. Environment variables (database, `JWT_SECRET`, Resend, CORS, etc.) are set in the Render dashboard; see `docs/BackendSetUp.md` and `docs/Email-and-Resend.md` for details.

---

## API surface (summary)

The Express app mounts routes such as (non-exhaustive): `/api/auth`, `/api/patients`, `/api/reminders`, `/api/activity`, `/api/location`, `/api/safe-zones`, `/api/push`, `/api/games`, `/api/messages`, plus a **health** route. For full details, use `backend/src/httpApp.js` and the `routes/` and `controllers/` directories, and the extended API notes in `docs/BackendSetUp.md` and `docs/Backend.md`.

---

## Security and quality

- **Role and ownership checks** on patient-scoped data
- **Dependency audits** at the monorepo level: `npm run audit:all` (root `package.json` )
- **Security** considerations and test notes in `docs/BackendSetUp.md` and related documentation
- **Data encryption** at rest for selected fields: `docs/DataEncryption.md`

---

## Further documentation

| Document | Content |
|----------|---------|
| `docs/BackendSetUp.md` | Environment variables, email, database, running the API |
| `docs/Backend.md` | Backend architecture and API notes |
| `docs/CaregiverDashboard.md` | Caregiver client |
| `docs/PatientApp.md` | Patient PWA and flows |
| `docs/LocationMap.md` & `docs/GeolocationSharing.md` | Location and map behaviour |
| `docs/Email-and-Resend.md` | Transactional email and Resend |
| `docs/DataEncryption.md` | Field-level encryption |
| `docs/CognitiveGames_Dementia.md` | Games design and rationale |
| `docs/patient-app-accessibility-rationale.md` | Accessibility approach on the patient app |
| `docs/web-calling-and-deployment-rationale.md` | WebRTC, hosting, and deployment considerations |

---

## Project governance

- **DoD** and weekly log: see `DoD.md` and `PROJECTLOG.md`
- Milestone and process evidence (including GitLab issues and sprints) are recorded in `PROJECTLOG.md` and the linked tracker history

---

## Author

MSc project work by **Noreen** — **University of Leicester** (2025–2026).

All rights reserved unless otherwise required by the degree programme. This code and documentation are provided for **assessment, education, and demonstration**; they are not offered as a commercial product or a regulated health application.
