# Email delivery: problems and fix (Resend)

This document explains what broke, why, what we changed, and how to **Resend** got set up so invite and transactional emails work in production.

---

## 1. What we needed

NeuroEase sends emails for things like:

- **Caregiver → patient “invite to app”** (magic link / onboarding)
- Optionally: verification and other transactional mail

The backend uses **Nodemailer** for SMTP (e.g. Gmail) **or** the **Resend** HTTP API when `RESEND_API_KEY` is set (see `backend/src/utils/emailService.js`).

---

## 2. What went wrong (the “struggle”)

### Symptom

- Logs showed connection attempts to **`smtp.gmail.com`** (port **587**), then errors like **`ETIMEDOUT`** or connection failures.
- Invite / verification emails did **not** arrive reliably (or at all) when the API ran on **cloud hosting**.

### Why it happened (technical cause)

1. **SMTP is a different protocol and port from normal web traffic**  
   Gmail and most providers expect you to connect to **port 587** (or 465/25) and speak SMTP. That traffic is **not** the same as loading a website over **HTTPS (443)**.

2. **Many PaaS platforms restrict or block outbound SMTP**  
   Free and some paid tiers on providers like **Render** and others **block or throttle outbound SMTP** to reduce spam. Even when DNS resolves and the app “looks” configured correctly, the **TCP connection to the mail server never completes** → timeouts (`ETIMEDOUT`).

3. **IPv4 vs IPv6**  
   Some stacks try **IPv6** first; if the host has no working IPv6 route to the mail server, behaviour can be flaky. The codebase mitigates SMTP by forcing **IPv4** for the SMTP host where possible — but that **does not fix** a platform that **blocks SMTP entirely**.

4. **Not a “bug in the invite feature”**  
   The failure was **infrastructure / network policy**, not necessarily bad application logic. That’s why switching to a **mail API over HTTPS** fixes it without changing core product code.

---

## 3. Why we chose Resend (design decision)

| Approach | Pros | Cons |
|----------|------|------|
| **Gmail SMTP from cloud** | Familiar; no new vendor | Often **blocked or times out** on free PaaS; app passwords and security settings are fiddly |
| **Resend (HTTP API)** | Uses **HTTPS (443)** — usually **allowed**; simple API key; free tier for development | Need a Resend account; sender domain is **`onboarding@resend.dev`** until you verify your own domain |

**Decision:** Use **Resend in production** (`RESEND_API_KEY` + `MAIL_FROM`) so email is sent over **HTTPS**, which cloud hosts treat like normal outbound web traffic. Keep **optional SMTP** in `.env` for **local development** if you want.

---

## 4. Architecture note 

- **Setup:** **Backend API + both frontends on Render** (see `docs/Deployment.md`). **Resend** uses HTTPS, so email works on Render’s free tier even though **SMTP** often does not.
- **Email** is sent **only from the backend**. Set **`RESEND_API_KEY`** and **`MAIL_FROM`** on the **Render Web Service** (or whichever service runs `npm start` for the API), **not** on the static sites.

---


## 5. To summarise

> *We originally used Gmail SMTP from the deployed API, but the hosting environment blocked or timed out outbound SMTP connections, so emails never left the server. That’s a known limitation of many free cloud platforms, not a logic error in our invite code. We switched to **Resend**, which sends email over **HTTPS** using an API key, so delivery works reliably. We documented the env vars and kept optional SMTP for local development.*

---
