# NeuroEase — Security testing (dependency audit, automation, checklist)

This document supports dissertation **“security testing”** sections with concrete activities, tools, and results. It is **not** a full penetration test or formal certification.

**Related:** Automated API tests (`cd backend && npm test`) are documented in `BackendSetUp.md` **§11**.

---

## 1. Objectives

| Goal | Method |
|------|--------|
| Known vulnerable dependencies | `npm audit` on each app |
| Authentication & access control regressions | Jest + Supertest integration tests (backend) |
| Design & configuration | Checklist (JWT, HTTPS, RBAC, validation) |
| Deep dynamic / professional assessment | **Out of scope** (optional: OWASP ZAP, third-party pen test) |

---

## 2. Dependency scanning (`npm audit`)

Run from repository root (or each folder) whenever dependencies change or before submission:

```bash
cd backend && npm audit
cd ../patient-app && npm audit
cd ../caregiver-dashboard && npm audit
cd .. && npm audit
```

**Remediation:** Prefer `npm audit fix` (non-breaking). Avoid `npm audit fix --force` without reviewing breaking upgrades (especially native addons like `bcrypt`).

### 2.1 Results recorded (maintenance run)

| Package area | `npm audit fix` | Post-fix status (snapshot) |
|--------------|-----------------|-----------------------------|
| **patient-app** | Yes | **0 vulnerabilities** |
| **caregiver-dashboard** | Yes | **0 vulnerabilities** |
| **repo root** (`concurrently` only) | N/A | **0 vulnerabilities** |
| **backend** | Yes + **`bcrypt@6`** | **0 vulnerabilities** (upgrade removes the old `bcrypt` 5.x / `node-pre-gyp` / `tar` chain; `User.js` still uses `bcrypt.hash` / `bcrypt.compare` — API unchanged for this codebase). |

Re-run after `npm install` or dependency bumps:

```bash
cd backend && npm audit
```

**If audits return issues again:** run `npm audit fix`, then review any remaining items; major upgrades (e.g. `express`, `sequelize`) may need code changes and full regression tests.

---

## 3. Automated tests with security relevance

Backend integration tests (see `backend/tests/api.integration.test.js`) intentionally cover:

| Behaviour | Security theme |
|-----------|----------------|
| Invalid login → `401` | **Authentication** — no account enumeration beyond generic message (verify controller wording in diss.). |
| Missing/invalid JWT → `401` on protected routes | **Session / token** enforcement. |
| Patient cannot read another patient’s profile → `403` | **Broken access control** (IDOR-style misuse). |
| Caregiver cannot `POST /api/games` | **Role-based access control (RBAC)**. |
| Location update rejected when pause active → `403` | **Consent / policy** enforcement on sensitive data. |

These are **targeted regression tests**, not exhaustive OWASP coverage.

---

## 4. Manual and design-level controls (what you built)

Document these in prose in the thesis as **security measures**, separate from `npm audit`:

| Control | Implementation notes |
|---------|------------------------|
| **Passwords** | Bcrypt hashing via User model hooks; strength rules on register (Yup). |
| **JWT** | Bearer token; `JWT_SECRET` from environment; short/medium expiry per user type (see `authController`). |
| **RBAC** | `userType` (`caregiver` \| `patient`) + middleware (`requireCaregiver`, `requirePatient`, `requireAny`). |
| **Input validation** | Yup on key routes; Sequelize parameterized queries (reduces injection risk vs raw concatenated SQL). |
| **Sensitive fields** | Encrypted getters/setters on selected models (see encryption utils). |
| **CORS** | Restricted origins in production; dev allowances documented in `server.js` / `httpApp.js`. |
| **Transport** | Production should use **HTTPS**; never commit `.env` or secrets. |
| **WebRTC / messaging** | Signalling relay; treat tokens and room membership as trust boundaries (describe assumptions). |

---

## 5. Mapping to OWASP Top 10 (2021) — high level

Use this table to **one paragraph per category** in the dissertation (not every cell needs a long discussion):

| Risk | Relevant to NeuroEase? | What you did / limit |
|------|------------------------|----------------------|
| A01 Broken Access Control | **Yes** | RBAC + ownership checks; automated tests for patient isolation. |
| A02 Cryptographic Failures | **Partial** | HTTPS in prod; bcrypt; field encryption where implemented. |
| A03 Injection | **Partial** | Sequelize + validation; note Sequelize JSON advisory history — keep ORM patched. |
| A04 Insecure Design | **Partial** | Document threat assumptions (e.g. trusted caregivers). |
| A05 Security Misconfiguration | **Yes** | Env-based secrets; CORS; disable debug stacks in prod. |
| A06 Vulnerable Components | **Yes** | `npm audit` + periodic upgrades (`bcrypt@6`, patched transitive deps). |
| A07 Id & Auth Failures | **Yes** | JWT, login tests, email verification for caregivers. |
| A08 Software/Data Integrity | **Low** | CI/subresource integrity if you add front-end build pipelines. |
| A09 Logging/Monitoring Failures | **Low** | Morgan logs; no central SIEM — state as limitation. |
| A10 SSRF | **Low** | Unless server fetches arbitrary URLs; note N/A or review `fetch` call sites. |

---

## 6. Explicitly out of scope (state honestly)

- Independent **penetration test** or **bug bounty**
- **Dynamic scanning** (Burp/ZAP) against production unless you set up a safe environment
- **Formal** ISO 27001 / SOC2 processes
- **100%** route or line coverage

---

## 7. Suggested “Security testing” paragraph for the dissertation

You may adapt:

*Dependency risk was reviewed with `npm audit` on the backend, patient app, and caregiver dashboard; fixes were applied where upgrades resolved advisories, including upgrading **`bcrypt` to major version 6** on the backend to clear transitive `tar` / `node-pre-gyp` findings while preserving the same hashing API in application code. After remediation, `npm audit` reported zero known vulnerabilities in those packages at the time of the audit. Authentication and authorisation behaviour were partially covered by automated API integration tests (login failure, JWT absence, cross-patient access denial, role restriction on game submission, and location pause enforcement). Additional assurance relies on design choices (bcrypt, JWT, RBAC, validation, encryption of selected fields, CORS, and production HTTPS). Full penetration testing was out of scope.*

---

## 8. Quick commands (submission checklist)

```bash
# Dependency audit
cd backend && npm audit
cd ../patient-app && npm audit
cd ../caregiver-dashboard && npm audit

# API regression (includes security-relevant cases)
cd ../backend && npm test
```
