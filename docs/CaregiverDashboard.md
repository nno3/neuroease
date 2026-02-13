# NeuroEase Caregiver Dashboard

## 1. Introduction and Purpose

The caregiver dashboard is the primary web interface for family or professional caregivers in the NeuroEase system. It allows caregivers to register, manage patient profiles, create and manage reminders (medication, appointments, tasks), view patient activity and reminder compliance, monitor patient location on a map with configurable safe zones, and receive alerts when a patient leaves a designated area. The dashboard is designed to be information-dense and efficient for caregivers while remaining clear and maintainable. It communicates with the NeuroEase backend API over REST and relies on JWT-based authentication and role-based access so that each caregiver sees only their assigned patients and related data. The caregiver dashboard and patient application are entirely separate front-end codebases and build processes; they share the same backend API but are optimised for their respective users and devices.

---

## 2. Technology Stack and Rationale

### 2.1 Core Framework: React and Vite

The dashboard is built with **React** [1] and **Vite** [2]. React was chosen for its component-based architecture, large ecosystem, and alignment with the project’s existing use of Node.js on the backend (single language across stack). Component composition supports reusable UI (modals, cards, sidebars) and clear separation between layout, pages, and services. Vite is used as the build tool and dev server instead of Create React App (CRA) or Webpack directly: it provides fast cold starts and hot module replacement (HMR) during development, and simple production builds. This reduces feedback time during UI work and keeps the toolchain minimal.

### 2.2 Routing: React Router

**React Router** [3] (v7) handles client-side routing. Public routes (login, register, verify-email) are rendered outside the main layout; protected routes (dashboard, patients, reminders, activity, location, settings) are wrapped in a layout that includes the sidebar and top bar. This keeps authentication boundaries explicit and allows the layout to stay fixed while only the main content area scrolls, which improves usability on long pages (e.g. reminder lists or location alerts).

### 2.3 UI and Styling

- **Lucide React** [4]: Icon set used for navigation, actions, and status (e.g. alert triangles, checkmarks, map pins). Icons are consistent and tree-shakeable, which keeps bundle size down compared to loading a full icon font.
- **Plain CSS (no Tailwind/CSS-in-JS)**: Styles are organised in per-component or per-page CSS files (e.g. `Layout.css`, `Sidebar.css`, `Dashboard.css`). This avoids adding a runtime or build-time CSS framework and keeps styling predictable and easy to audit for contrast and touch targets. Naming uses BEM-like prefixes (e.g. `sidebar-link`, `pa-alert-card`) to avoid clashes. Plain CSS was chosen for its simplicity and zero runtime overhead. To manage scale, a strict BEM-like naming convention is enforced; migration to CSS Modules will be considered if style conflicts or maintainability become a significant issue.
- **date-fns** [5]: Used for formatting and parsing dates and times in reminders, activity, and location alerts. It was chosen over Moment.js for its smaller footprint and immutable API, and over native `Intl` alone for consistent formatting and relative-time helpers across the app.
- **react-datepicker**: Used in reminder and patient forms for picking dates and times. It provides an accessible date picker that works with the existing form and validation flow.

### 2.4 Maps: Leaflet and React-Leaflet

**Leaflet** [6] and **React-Leaflet** [7] power the Location page. This stack was chosen in part because of prior experience from the GreenBrighton project ([GreenBrighton interactive map](https://nno3.github.io/BrightonGreen/map.html)), where the same Leaflet + OpenStreetMap approach was used for an interactive map of attractions, parks, and points of interest. Leaflet is open-source and works well with OpenStreetMap tiles; it does not require an API key for base maps, which simplifies setup and avoids key management. React-Leaflet exposes Leaflet as React components (e.g. `MapContainer`, `TileLayer`, `Circle`, `Marker`), so the map, safe zones, and patient markers are composed in the same way as the rest of the UI. Geofencing (point-in-circle) is implemented in application code using the Haversine formula rather than a separate GIS server, which is sufficient for the current safe-zone model (centre + radius per zone). The Haversine calculation on the front end is used only for *current* status (e.g. whether the patient’s latest position is inside or outside a zone for marker colour). The generation of historical alerts (“Left safe zone”, “Returned to safe zone”) is done on the backend when location updates are processed; the dashboard merely displays and filters these pre-generated alerts.

---

## 3. Architecture

### 3.1 Entry and Routing Structure

The app is bootstrapped in `main.jsx`: the root is wrapped in `AuthProvider`, then `BrowserRouter`, then `App`. `App.jsx` defines all routes. Unauthenticated routes are `/login`, `/register`, and `/verify-email`. All other routes are nested under a single layout wrapped by `ProtectedRoute`; the layout renders `Sidebar`, `TopBar`, and an `Outlet` for the current route (Dashboard, Patients, Reminders, Activity, Location, Settings). A catch-all route redirects unknown paths to the index route.

### 3.2 Authentication and Authorisation

Authentication state is held in **AuthContext** (`context/AuthContext.jsx`). On load, the context checks for a stored JWT and user object in `localStorage`; if present, the user is treated as logged in. Login and registration call the backend auth API; on success, the token and user data are stored and the context updates. **ProtectedRoute** reads the context and redirects to `/login` when there is no user, so all dashboard pages are behind login. The backend enforces role (caregiver vs patient) and data isolation; the dashboard assumes the logged-in user is a caregiver and does not expose patient-only flows. Avatar support is optional: the backend can store an avatar URL, and the TopBar shows either the avatar image or the user’s initials for a consistent header across devices.

### 3.3 API Layer

API calls go through a shared **apiClient** (`services/apiClient.js`). The base URL is taken from `import.meta.env.VITE_API_BASE` or a default (e.g. `http://localhost:5001/api`). Every request attaches `Content-Type: application/json` and, when available, `Authorization: Bearer <token>`. Responses are parsed as JSON; non-OK responses are thrown as errors with status and message so callers can show user-friendly messages. Domain-specific services (e.g. `authService.js`, `patients.js`, `reminders.js`, `dashboardService.js`, `activityService.js`, `locationService.js`) use this client and expose functions like `getPatients()`, `getDashboardStats()`, `getLocationAlerts(patientId)`, etc. This centralises base URL and auth and keeps pages focused on UI and local state.

### 3.4 Layout and Scroll Behaviour

The layout uses a fixed sidebar and top bar with a scrollable main content area. The main content container has `overflow-y: auto` and appropriate flex so that only the centre panel scrolls when content is long (e.g. reminder list or location alerts). The sidebar is fixed in height and includes navigation links (Dashboard, Patients, Reminders, Activity, Location) and a separate block at the bottom for Settings. This separation makes Settings easy to find and keeps primary navigation stable. The TopBar shows the current user (avatar or initials) and links to Settings rather than a dropdown of mixed actions, reducing clutter.

---

## 4. Main Features

### 4.1 Dashboard (Home)

The Dashboard aggregates high-level information: counts of active patients, reminder compliance, games played today, and active location alerts. It shows a short list of assigned patients with actions to view details or edit, and an optional activity summary. If there are recent location alerts or patients currently outside a safe zone, a dismissible banner appears with a link to the Location page. The dashboard does not duplicate the full reminder calendar or full activity log; those live on the Reminders and Activity pages. This keeps the home view scannable while still directing caregivers to alerts and key actions.

### 4.2 Patients

The Patients page lists all patients assigned to the caregiver. Each patient can be opened in a details modal (profile summary, link to “Patient activity”) or edited in a form modal. The patient form supports profile fields and optional avatar; it also captures location-sharing consent so that location and safe-zone features are only used when the patient has agreed. Archiving is supported so that inactive patients can be hidden without deleting data. Patient creation and editing call the backend patient API with validation and ownership checks enforced on the server.

### 4.3 Reminders

Reminders are created and edited per patient with type (medication, appointment, task), schedule, and recurrence. The Reminders page provides a calendar-style view and list so caregivers can see what is due when. Reminder data is fetched from the backend and displayed with clear due dates and completion status. The patient app will consume the same reminder API so that patients see and complete reminders; the dashboard is the authoring and monitoring surface.

### 4.4 Activity

The Activity page shows reminder and game activity for the caregiver’s patients. It helps caregivers see compliance and engagement over time. Data is sourced from the backend activity and reminder endpoints. Where relevant, the dashboard links to a per-patient “Patient activity” view (e.g. from the patient details modal) for a fuller picture of one patient’s reminders, games, and location status.

### 4.5 Location

The Location page shows a map of patient positions and safe zones. Caregivers can select a patient (or “all”) and see the latest reported location and any defined safe zones (centre + radius). The map uses Leaflet and OpenStreetMap; zones are drawn as circles and the patient’s marker colour indicates whether they are inside or outside a zone (e.g. green inside, red outside). Caregivers can add, edit, or remove safe zones for a selected patient when that patient has location sharing enabled. Location alerts (e.g. “Left safe zone”, “Returned to safe zone”) are shown in a dedicated section with a time-period filter (today, this week, this month) and distinct styling for “left” vs “returned” so that patterns and duration outside the zone are easy to see. The backend records location updates and generates alerts when a patient crosses zone boundaries; the dashboard only displays and filters this data.

### 4.6 Settings

The Settings page is a single panel that groups: profile (name, email, avatar), change password, session management, and delete account. Gaps between sections make the blocks visually distinct. This keeps all account and security actions in one place and avoids scattering them across the TopBar or sidebar.

### 4.7 Auth Flows: Login, Register, Verify Email

Caregivers register via the Register page; the backend may require email verification before the first login. The verify-email page reads a token from the URL (e.g. from an email link) and calls the backend to confirm the address; on success, the user can log in. Login uses email and password and stores the JWT and user in context and localStorage so that protected routes and API calls are authenticated. The dashboard does not implement patient login; the patient app is a separate front end with its own auth flow (e.g. magic link or invite-based).

---

## 5. Design Decisions

### 5.1 Single-Page Application and API Base URL

The dashboard is a single-page application (SPA): the initial HTML loads once and React Router switches views without full page reloads. The backend is separate and can be on another host or port. The API base URL is configured via `VITE_API_BASE` so that the same build can target different environments (e.g. local backend vs production). In development, Vite’s proxy can forward `/api` to the backend to avoid CORS and keep the dev setup simple.

### 5.2 Protected Routes and Token Storage

Protected routes are implemented in the client by checking AuthContext; the backend still validates the JWT on every API request. Storing the token in `localStorage` is a common choice for SPAs and allows the session to persist across tabs and reloads. The trade-off (e.g. XSS vs CSRF) is documented in security literature [8]; for this project, token in localStorage with HTTPS and secure backend tokens is accepted for the caregiver dashboard. To mitigate the risk of XSS, the application should employ a strict Content Security Policy (CSP) to limit the sources from which scripts can be executed. Logout clears the stored token and user so that the next navigation hits ProtectedRoute and redirects to login.

### 5.3 Location Alerts and Colour Coding

Location alerts are shown with distinct colours and icons: e.g. orange/amber for “left safe zone” or “currently outside”, green for “returned to safe zone”, with “Was out for X min” when applicable. This follows a simple traffic-light metaphor and helps caregivers quickly see status and duration. The same pattern is used on the Location page and in the patient activity modal for consistency.

### 5.4 Accessibility and Touch Targets

The dashboard is built for use on desktop and tablet. Where it affects patients (e.g. shared components or future reuse), touch targets and contrast are considered. The patient app, which is used directly by people with MCI or dementia, has stricter accessibility requirements (e.g. WCAG [9]) and is documented separately. The dashboard uses semantic structure (header, main, nav), ARIA where helpful (e.g. aria-label on icon-only controls), and avoids blocking zoom.

---

## 6. Project Structure (Summary)

High-level tree of the dashboard source:

```
caregiver-dashboard/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── Layout.jsx, Layout.css
│   │   ├── Sidebar.jsx, Sidebar.css
│   │   ├── TopBar.jsx, TopBar.css
│   │   ├── ProtectedRoute.jsx
│   │   ├── PatientFormModal.jsx
│   │   ├── PatientDetailsModal.jsx
│   │   ├── PatientActivityModal.jsx
│   │   ├── ReminderFormModal.jsx
│   │   ├── ReminderCalendar.jsx
│   │   └── dashboard/
│   │       ├── DashboardStats.jsx
│   │       ├── KPICard.jsx
│   │       └── ActivitySummaryVisual.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx, Dashboard.css
│   │   ├── Patients.jsx, Patients.css
│   │   ├── Reminders.jsx, Reminders.css
│   │   ├── Activity.jsx
│   │   ├── Location.jsx
│   │   ├── Settings.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── VerifyEmail.jsx
│   ├── services/
│   │   ├── apiClient.js
│   │   ├── authService.js
│   │   ├── patients.js
│   │   ├── reminders.js
│   │   ├── dashboardService.js
│   │   ├── activityService.js
│   │   └── locationService.js
│   └── utils/
│       └── patientHelpers.js
├── public/
├── index.html
├── vite.config.js
└── package.json
```

| Path | Purpose |
|------|--------|
| `src/App.jsx` | Route definitions and layout nesting |
| `src/main.jsx` | Root render, AuthProvider, BrowserRouter |
| `src/context/AuthContext.jsx` | Auth state and login/logout |
| `src/components/ProtectedRoute.jsx` | Redirect to login when unauthenticated |
| `src/components/Layout.jsx`, `Layout.css` | Shell: Sidebar + TopBar + scrollable content |
| `src/components/Sidebar.jsx`, `Sidebar.css` | Main navigation; Settings at bottom |
| `src/components/TopBar.jsx`, `TopBar.css` | User avatar/initials, link to Settings |
| `src/pages/*.jsx` | Dashboard, Patients, Reminders, Activity, Location, Settings, Login, Register, VerifyEmail |
| `src/components/PatientFormModal.jsx` | Create/edit patient |
| `src/components/PatientDetailsModal.jsx` | View patient, link to activity |
| `src/components/PatientActivityModal.jsx` | Per-patient activity and location alerts |
| `src/components/ReminderFormModal.jsx`, `ReminderCalendar.jsx` | Reminder creation and calendar view |
| `src/services/apiClient.js` | Shared fetch + auth header |
| `src/services/*.js` | Auth, patients, reminders, dashboard, activity, location API wrappers |
| `src/utils/patientHelpers.js` | Helpers (e.g. initials, ID formatting) |
| `vite.config.js` | Vite config and API proxy |

---

## 7. Running the Dashboard

From the project root:

```bash
cd caregiver-dashboard
npm install
npm run dev
```

The app is served at **http://localhost:5173** (or the port shown in the terminal). The backend must be running (e.g. `cd backend && npm run dev` on port 5001) for API calls to succeed. To point at a different API origin, set `VITE_API_BASE` in a `.env` file in `caregiver-dashboard/` (e.g. `VITE_API_BASE=http://localhost:5001/api`).

---

## 8. References

[1] React, “Main concepts,” React Documentation. [Online]. Available: https://react.dev/learn. [Accessed: Jan. 30, 2026].

[2] Vite, “Guide,” Vite. [Online]. Available: https://vitejs.dev/guide/. [Accessed: Jan. 30, 2026].

[3] React Router, “Overview,” React Router. [Online]. Available: https://reactrouter.com/en/main/start/overview. [Accessed: Jan. 30, 2026].

[4] Lucide, “Lucide,” Lucide Icons. [Online]. Available: https://lucide.dev/. [Accessed: Jan. 30, 2026].

[5] date-fns, “date-fns - modern JavaScript date utility library,” date-fns. [Online]. Available: https://date-fns.org/. [Accessed: Jan. 30, 2026].

[6] Leaflet, “Leaflet — an open-source JavaScript library for mobile-friendly interactive maps,” Leaflet. [Online]. Available: https://leafletjs.com/. [Accessed: Jan. 30, 2026].

[7] React-Leaflet, “React components for Leaflet maps,” React-Leaflet. [Online]. Available: https://react-leaflet.js.org/. [Accessed: Jan. 30, 2026].

[8] OWASP, “Session Management Cheat Sheet,” OWASP Foundation. [Online]. Available: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html. [Accessed: Jan. 30, 2026].

[9] W3C, “Web Content Accessibility Guidelines (WCAG) 2.1,” W3C, Jun. 2018. [Online]. Available: https://www.w3.org/TR/WCAG21/. [Accessed: Jan. 30, 2026].
