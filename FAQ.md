# NeuroEase — frequently asked questions

## Where is everything documented?

- **Run locally:** [README.md](README.md) and [docs/BackendSetUp.md](docs/BackendSetUp.md)
- **API and backend structure:** [docs/Backend.md](docs/Backend.md)
- **Caregiver app:** [docs/CaregiverDashboard.md](docs/CaregiverDashboard.md)
- **Patient PWA:** [docs/PatientApp.md](docs/PatientApp.md)

## How do I start the whole stack during development?

From the repository root, after installing dependencies in each package, use `npm run dev:all` (see the root [package.json](package.json)). Alternatively run the **backend**, **caregiver-dashboard**, and **patient-app** dev servers in separate terminals.

## Why do I see no email in the inbox on signup?

For local development, **`RESEND_API_KEY`** may be unset. In that case a **email verification** link may be printed in the **backend** terminal. For production, set **Resend** and **`MAIL_FROM`** as in [docs/BackendSetUp.md](docs/BackendSetUp.md) and [docs/Email-and-Resend.md](docs/Email-and-Resend.md).

## What about Git history, large files, and `.gitignore`?

Follow normal Git practice: do not commit `node_modules` or build output; keep database dumps and local `.env` files out of the remote if they contain secrets. The repository includes a [`.gitignore`](.gitignore) for common Node and OS artefacts; extend it as needed for your environment.

## Where is the product changelog or sprint history?

The project log is in [PROJECTLOG.md](PROJECTLOG.md). Process and issues may also be recorded in your Git host (e.g. GitLab) if you use that for tracking.
