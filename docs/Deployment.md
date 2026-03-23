# NeuroEase Deployment Guide

A free-tier setup using **Supabase** (PostgreSQL) + **Render** (backend + frontends). Total cost: **$0**.

---

## Overview

| Component          | Service   | Free tier                          |
|-------------------|-----------|------------------------------------|
| Database           | Supabase  | 500MB Postgres                     |
| Backend API        | Render    | Web Service (spins down when idle) |
| Caregiver Dashboard| Render    | Static Site                        |
| Patient App        | Render    | Static Site                        |

**Data migration:** You export from your local database and import into Supabase, so your existing patients and data stay.

---

## Part 1: Create Supabase Database

1. Go to [supabase.com](https://supabase.com) and sign up (free).

2. **New project** → Name it `neuroease` → Set a database password (save it).

3. Wait for the project to finish provisioning.

4. **Project Settings** → **Database** → Copy:
   - **Connection string** (URI format)  
     It looks like: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`

5. For the **Direct connection** (port 5432), enable "Use connection pooling" if you use the pooler URL. The **Transaction** pooler (port 6543) is fine for Sequelize.

---

## Part 2: Migrate Your Local Data

Export from your local PostgreSQL and import into Supabase.

### 2a. Export from local

```bash
# Replace with your actual DB_NAME, DB_USER, DB_HOST if different
pg_dump -h localhost -U neuroease_user -d neuroease_db -F c -f neuroease_backup.dump
```

If you use a different user/db name, check `backend/.env` for `DB_USER` and `DB_NAME`.

### 2b. Import into Supabase

1. In Supabase dashboard: **SQL Editor** → New query.

2. Run this first (clears tables so you can import):

```sql
-- Drop existing tables (Supabase creates some by default; we'll replace with yours)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

3. Import using `pg_restore`:

```bash
# Use the Supabase connection string - replace [YOUR-PASSWORD] and ensure it's the direct connection (port 5432) for restore
pg_restore -h db.xxxxxxxxxxxx.supabase.co -U postgres -d postgres -F c neuroease_backup.dump --no-owner --no-acl
```

Or use **Supabase SQL Editor** if you exported as SQL:

```bash
pg_dump -h localhost -U neuroease_user -d neuroease_db --no-owner --no-acl > neuroease.sql
```

Then paste the SQL into the editor and run it.

### 2c. Seed test caregiver (if needed)

```bash
cd backend
# Temporarily point .env to Supabase DATABASE_URL, then:
npm run seed:test-caregiver
```

Or set `DATABASE_URL` to your Supabase URI and run the seed before deploying.

---

## Part 3: Deploy Backend on Render

1. Go to [render.com](https://render.com) and sign up.

2. **New +** → **Web Service**.

3. Connect your GitHub/GitLab repo. Select the `na429` (or your repo) repository.

4. Configure:
   - **Name:** `neuroease-api`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

5. **Environment Variables** (Add all):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `5001` |
   | `JWT_SECRET` | (Generate: `openssl rand -hex 32`) |
   | `DATABASE_URL` | Your Supabase connection string |
   | `DATABASE_SSL` | `1` |
   | `FRONTEND_URL` | `https://neuroease-dashboard.onrender.com` *(update after you create the dashboard)* |
   | `PATIENT_APP_URL` | `https://neuroease-patient.onrender.com` *(update after you create the patient app)* |
   | `USABILITY_TESTING` | `1` |
   | `TEST_CAREGIVER_EMAIL` | `test.caregiver@neuroease.test` |
   | `MAIL_FROM` | Your email (e.g. `neuroease@gmail.com`) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Your Gmail |
   | `SMTP_PASS` | Gmail App Password |

   For SMTP: If you skip it, verification links are logged in Render logs (you can copy and open them). For real emails, use [Gmail App Passwords](https://support.google.com/accounts/answer/185833).

6. **Create Web Service**. Wait for the first deploy.

7. Copy your backend URL, e.g. `https://neuroease-api.onrender.com`.

---

## Part 4: Deploy Caregiver Dashboard

1. **New +** → **Static Site**.

2. Connect the same repo.

3. Configure:
   - **Name:** `neuroease-dashboard`
   - **Root Directory:** `caregiver-dashboard`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Environment Variables** (add before first build):

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE` | `https://neuroease-api.onrender.com/api` |
   | `VITE_USABILITY_TESTING` | `1` |
   | `VITE_TEST_CAREGIVER_EMAIL` | `test.caregiver@neuroease.test` |

5. **Create Static Site**. Copy the URL (e.g. `https://neuroease-dashboard.onrender.com`).

6. **Update backend env:** In the backend service, set `FRONTEND_URL` to this dashboard URL.

---

## Part 5: Deploy Patient App

1. **New +** → **Static Site**.

2. Connect the same repo.

3. Configure:
   - **Name:** `neuroease-patient`
   - **Root Directory:** `patient-app`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE` | `https://neuroease-api.onrender.com/api` |
   | `VITE_USABILITY_TESTING` | `1` |

5. **Create Static Site**. Copy the URL.

6. **Update backend env:** Set `PATIENT_APP_URL` to this patient app URL.

---

## Part 6: CORS (if needed)

The backend uses `cors()` with default settings. If you see CORS errors in the browser, you may need to restrict origins. Check `backend/server.js` — you can add:

```javascript
app.use(cors({ origin: [
  'https://neuroease-dashboard.onrender.com',
  'https://neuroease-patient.onrender.com'
] }));
```

---

## URLs Summary

After deployment you'll have:

- **Caregiver login:** `https://neuroease-dashboard.onrender.com`
- **Patient app:** `https://neuroease-patient.onrender.com`
- **API:** `https://neuroease-api.onrender.com/api`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend won't start | Check Render logs. Ensure `DATABASE_URL` is correct and `DATABASE_SSL=1` for Supabase. |
| "Failed to connect to database" | Verify Supabase connection string. Use the **Connection pooling** URI (port 6543) for long-running connections. |
| First request is slow | Render free tier spins down after ~15 min idle. First request may take 30–60 seconds. |
| Emails not sending | Set SMTP vars. Or copy verification links from Render logs. |
| CORS errors | Add your frontend URLs to `cors({ origin: [...] })` in `server.js`. |

---

## Switching Back to Local Development

Keep `backend/.env` with `DB_HOST`, `DB_NAME`, etc. for local PostgreSQL. Only use `DATABASE_URL` when deploying. For local dev, don't set `DATABASE_URL` and the backend uses your local DB.
