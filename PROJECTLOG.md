# Project Log


## Week 1 [w/c 29/09/2025]
- Reviewed existing memory-aid and dementia-care applications to understand current features, limitations, and user experience patterns.
- Took notes on common functionality (reminders, tracking, caregiver views) and identified gaps to be addressed by NeuroEase (e.g. integration of cognitive games, location, reminders).
- Discussed project direction and feasibility with supervisor and refined initial scope. 

## Week 2 [w/c 06/10/2025]
- Continued working on literature review on dementia, MCI and caregiver burden to support problem definition.
- Sketched a preliminary list of system features and data needs based on findings from application review and academic sources.

## Week 3 [w/c 13/10/2025]
- Investigated possible technology stacks for backend and frontend (Node.js/Express, React, PostgreSQL, alternative databases).
- Evaluated key libraries (authentication, charting, mapping, PWA support) and confirmed the decision to use a MERN-style stack with PostgreSQL instead of MongoDB.

## Week 4 [w/c 20/10/2025]
- Conducted a focused literature review on assistive technologies for dementia (Schepens Niemiec et al., Nwofe et al., Blok et al., etc.).
- Drafted literature review section for interim report linking academic work to the goals of NeuroEase (integrated support for patients, caregivers).
- Drafted software requirements and discussed them with supervisor for initial feedback. 

## Week 5 [w/c 27/10/2025]
- Produced a Software Requirements Specification (SRS) taking supervisor's feedback into account, including Functional and Non-Functional Requirements using the MoSCoW method.
- Defined user roles (Caregiver, Patient) and key use cases (reminder management, geofencing, activity monitoring, cognitive games).
- Added NeuroEase project folder structure supported by commit `dfb5986d` : 
  - Backend API with organised src folders
  - Caregiver Dashboard React application structure
  - Patient App React PWA structure
  - Documentation folders for documenting different parts of the project
  - Placeholder files to maintain folder structure in Git


## Week 6 [w/c 03/11/2025]
- Set up the Git branching strategy for upcoming development:
- Created `develop` branch for integrated work.
- Created feature branches: `feature/backend-database`, `feature/authentication`, `feature/caregiver-patient-management`, and `feature/patient-reminder-interface`. 
- Finalised the database schema for NeuroEase and implemented all entity relationships in PostgreSQL/Sequelize. (Commits: `76fc857b`, `96321ad8` on branch `feature/authentication`.)
- Added comprehensive system architecture documentation to the main branch, including high-level diagrams and explanation of the three-tier structure. (Commit: `cd677426` on `main`.)

## Week 7 [w/c 10/11/2025]
- Updated the main `README.md` on the `main` branch to reflect the latest project structure and documentation, improving clarity for anyone checking out the repository. (Commit: `54a06541`)
- Added comprehensive project overview documentation on the `feature/authentication` branch, summarising system purpose, architecture, and planned functionality to support future development and reporting. (Commit: `6f282905`)
- Identified circular dependency errors during unit testing when loading multiple models 
  - Implemented models/index.js as central hub to manage model associations and prevent import cycles
  - Fixed association patterns in all models (User, Patient, Reminder, GameSession, etc.)
  - Verified all relationships work: User to ️Patient (1:1), User to Reminders (1:M), User to GameSessions (1:M)
  - Tested and confirmed database integrity with successful CRUD operations across all tables
    - Root cause: Sequelize models trying to import each other directly caused dependency loops
    - Solution: Centralised association management through index file with deferred relationship setup, supported by commit `db474999`
- Integrated Morgan middleware into the Express backend to log API requests, laying the groundwork for easier debugging and monitoring during later development and testing phases. (Commit: `0e08a2f6`)
- Reviewed existing backend setup (authentication and database schema) to ensure consistency with the updated documentation and confirmed that branches and issues are aligned with the current project plan.

## Week 8 [w/c 17/11/2025] 
- Produced and worked on interim report, asked for feedback from supervisor and made changes accordingly.
- Completed and submitted interim report.
- Started Developing user Authentication & JWT in `Authentication` branch

## Week 9 [w/c 24/11/2025]
- Set up the first Scrum board in GitLab in line with the interim report: created workflow labels (`To Do`, `In Progress`, `Testing`, `Review`, `Done`) and configured a single board using these as status columns.
- Created the milestone **“Sprint 1 – Auth Backend (Phase 1)”** and added auth-related issues under it (`Develop User Authentication & JWT`, `Implement user registration/login`, `Add auth middleware & roles`), using the board to track their progress.
- Implemented and thoroughly tested the user registration and login endpoints (`POST /api/auth/register`, `POST /api/auth/login`), including email validation, password complexity rules, email uniqueness checks, bcrypt password hashing, and JWT token generation.
Verified behaviour using `curl` for successful logins, duplicate emails, invalid credentials, and confirmed hashed passwords are stored in the database (Commit: `ceb14c8f`).
- Created a dedicated `DoD.md` file defining a global Definition of Done, and a more specific one for backend and frontend tasks and how issues should move across the Scrum board.
- Contacted supervisor for any recommendations regarding the scrum board and adopted the suggested approach of keeping high-level user stories per feature (e.g. authentication) with technical GitLab issues underneath, while keeping the board and workflow simple.
- Extended authentication system with comprehensive middleware including JWT verification, role-based authorization, and Yup schema validation (Commit: `1bd3fc78`).
- Implemented complete data ownership and access control (Commit: `b822c477`), Patients can ONLY access their own data, Caregivers can ONLY access assigned patients
- Created patient assignment endpoint (POST /api/patients/assign)
- Added protected patient details endpoint with ownership checks
- Thoroughly tested complete auth system with curl commands verifying proper 403/404/409 error handling and access control enforcement.
- Actively used GitLab issues for tracking, regularly updated progress with commit references and moved issues through workflow stages.
- Completed Sprint 1 Auth Backend milestone with all authentication issues moved to "Done" after comprehensive testing.

## Week 10 [w/c 01/12/2025]
- Continued backend development in the `feature/patient-management` branch, focusing on implementing the full caregiver–patient workflow.
- Implemented the complete **Patient Management API**, including:
  - `POST /api/patients` – register new patients and create their profiles.
  - `GET /api/patients` – list all active patients assigned to the caregiver.
  - `GET /api/patients/:id` – view individual patient profiles with ownership checks.
  - `PUT /api/patients/:id` – update patient details.
  - `POST /api/patients/:id/archive` – soft-delete/archive patients with audit trail.
  - `POST /api/patients/:id/unarchive` – restore archived patients.
  - `GET /api/patients/archived` – filterable archived patient list.
  - `GET /api/patients/archive-audit` – caregiver audit history of patient lifecycle events.
- Added new database fields to support audit logging:
  `archiveReason`, `archiveNotes`, `archivedBy`, `unarchivedAt`, `unarchivedBy`, `unarchiveNotes`.
- Implemented strict **caregiver ownership enforcement** to ensure:
  - Caregivers only access their assigned patients.
  - Patients cannot access other patients’ data.
  - Archived patients do not appear in active lists.
- Added improved API error messages for empty states (e.g., “No active patients assigned”).
- Completed extensive manual cURL testing for all patient management endpoints, including edge cases and error handling.
- Discussed key architectural questions with supervisor and worked on the feedback provided

## Week 11 [w/c 08/12/2025]
Updated API behaviour to display meaningful messages when patient lists are empty (active or archived).
Added additional sanitisation and safety checks to prevent malformed requests from causing internal errors.
Performed deep debugging and refinement of the archive/unarchive lifecycle to ensure:
  - Archived patients disappear from active lists.
  - Unarchived patients correctly reappear.
  - Audit timestamps and metadata are consistently updated.
Cleaned up outdated database field references and fully aligned models/controllers with the new schema (`isArchived`, `archivedAt`, etc.).
Conducted comprehensive manual cURL tests covering:
  - Registration, updates, archive, unarchive
  - Ownership validation
  - Audit log integrity
  - Error formatting and state consistency
Finalised and stabilised the entire Patient Management API.
All major changes were captured in commit **`3a669f54`**
**Extensive Manual cURL Testing & Debugging Process**

  - During the testing stage of the _Patient Management API_, I carried out extensive manual cURL tests to validate the behaviour of all endpoints, with a major focus on ensuring that the archive workflow (soft-delete) worked consistently across:

  * `/api/patients/:id/archive`
  * `/api/patients`
  * `/api/patients/archived`
  * `/api/patients/:id/unarchive`

  **Initial Problem Identified**
  
  During early testing, archiving a patient produced a _success message_, but the patient still appeared in the active list:
  
  ```sh
  curl -X POST http://localhost:5001/api/patients/2/archive \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "archiveReason": "discharged",
      "notes": "Patient discharged after recovery"
    }'
  ```

  Output:
  ```
  {"success":true,"message":"Patient archived successfully","data":{"patientId":2}}
  ```
  
  However, immediately after:
  
  ```sh
  curl -X GET http://localhost:5001/api/patients \
    -H "Authorization: Bearer $TOKEN"
  ```
  The archived patient still appeared in the active patients list, showing:
  
  ```
  "isArchived": false
  ```
  
  Accessing the archived patients list also produced inconsistent errors such as:
  
  ```
  {"success":false,"message":"Access denied. Patient not assigned to you."}
  ```
  
  and later:
  
  ```
  {"success":false,"message":"Error fetching archived patients"}
  ```
  
  **Root Causes Identified Over Several Days of Debugging**
  
  Through iterative testing and console logging, the following bugs were identified and fixed:
  
  * Missing `archiveReason`, `archivedBy`, and related audit fields in the database schema
    * Sequelize model not including archive-related fields correctly
    * Incorrect validation behaviour when no archived patients existed
    * Incorrect logic in fetching archived vs active patient lists
    * Caregiver ownership checks firing incorrectly and blocking access
    * Archived patients not being excluded properly in the "active" `/api/patients` query
    * Error responses too generic when lists were empty (now improved)
  
  **Final Working Behaviour**
  
  After multiple revisions, the archiving system now works reliably and consistently.
  Output now correctly displays archived patients or shows a meaningful message


Here is your **Week 12 project log entry**, written professionally and matching the style of your previous weeks.
You can copy/paste directly into your `PROJECTLOG.md`.

---

## Week 12 [w/c 15/12/2025] 

- Began development of the **Reminder Management API** on the dedicated branch `feature/reminder-management-api`, following the same architecture and coding practices used for the patient management system.

- Implemented all core backend reminder features (Commit: `ac38f419`), including:
  - `POST /api/reminders` – Create a reminder
  - `GET /api/reminders/patient/:patientId` – Retrieve all reminders for a specific patient
  - `PUT /api/reminders/:id` – Update reminder attributes
  - `DELETE /api/reminders/:id` – Delete an existing reminder
- Added full Yup validation schemas to ensure strict input validation for reminder creation and updates (title, message, reminderType, scheduledTime, recurrence).
- Integrated ownership enforcement into all endpoints:
- Caregivers may only manage reminders for patients assigned to them.
- Patients can only access or modify their own reminders.
- Unauthorized access produces correct 403 responses.
- Updated Sequelize models and associations to incorporate reminder relationships.
- Debugged and resolved critical errors related to:
  - Validation middleware export/import issues
  - Route-level middleware setup
  - Sequelize association conflicts caused by duplicate `.hasMany()` declarations
  - Environment variable issues after recloning the repository
- Carried out extensive end-to-end manual cURL testing for all reminder routes:
  - Successful authentication and token extraction
  - Reminder creation for valid assigned patients
  - Correct rejection of unauthorized attempts
  - Retrieval of patient reminders with accurate filtering
  - Full update and delete flows
  - Multiple reminder creation scenarios (medication, appointment, general)
  - Validation of recurrence and scheduled time handling
- Confirmed all endpoints function correctly with proper validation, persistence, and security meeting the API requirements defined in the initial system architecture.
- merged the branch into developed as it was fully functioning and passed all necessary requirements supported by commit `ac38f419`.

## Week 13 [w/c 22/12/2025] 

Due to delays carried over from previous weeks, Sprint 3 required more extensive work during this period to meet the project schedule and bring development back on track. In particular, the backend archiving/retention functionality took longer than expected, which slowed overall progress and reduced the time available for the caregiver dashboard sprint. To recover the timeline, additional development effort was allocated this week to complete Sprint 3 deliverables and ensure alignment with the planned schedule.

- Sprint recovery and completion approach
  - Reviewed outstanding Sprint 3 issues to identify incomplete tasks and areas requiring refinement before review.
  - Prioritised delivery of a functional caregiver dashboard skeleton and authentication flow to ensure the system remains implementation-ready for the next phase.

- Caregiver dashboard skeleton finalisation (Issue #6)
  - Completed the remaining tasks required to finalise the caregiver dashboard React application foundation.
  - Ensured authentication state handling and protected routing were stable and suitable for continued feature development.
  - Finalised Sprint 3 foundation work:
    - `f5e68105` added and completed the missing tasks of Sprint 3 (Issue #6)
  - Performed manual UI verification testing, documented that testing passed, and progressed the issue towards review.

- Dashboard KPI / overview section delivery and sign-off (Issue #7)
  - Implemented and validated the dashboard KPI/overview section, ensuring design-system consistency and reliable rendering.
  - Confirmed no visible UI issues or major errors after testing; posted evidence and moved the issue to review.
  - Supporting implementation commit:
    - `e7dbe8cd` added dashboard mock stats in dashboard page

- Caregiver login and registration UI with backend integration (Issue #8)
  - Implemented dedicated authentication pages with backend integration to support realistic user onboarding and login behaviour:
    - Created a dedicated **Register** page with form validation aligned to backend requirements.
    - Created a **Login** page with error handling and a quick login fallback to support development testing.
    - Added/extended `AuthContext` to support both real API authentication and a development mock login flow.
    - Implemented password strength validation (minimum 8 characters, uppercase, lowercase, and number).
    - Added clear success and error feedback based on backend responses.
    - Ensured UI styling remains consistent with the established design system.
  - Delivered through the feature branch implementation commit:
    - `cabc728f` implemented separate login and registration pages with backend integration

- Added backend documentation updates to support maintainability and academic reporting:
  - `90289569` added backend documentations to main branch
- Merged the completed Sprint 3 feature branch into `develop` to consolidate work and establish a stable baseline for the next sprint:
   - `18c23376` merge branch `feature/caregiver-dashboard-skeleton` into `develop`
  - This merge ensured the `develop` branch contains the completed dashboard skeleton, KPI overview section, authentication UI, and the supporting context/routing logic required for subsequent development.
- Sprint 3 is complete, has passed manual UI-level testing, and has been merged into `develop`. Following the earlier slowdown caused by the longer-than-expected archiving/retention implementation, progress is now back on track and aligned with the intended schedule.

## Week 14 [w/c 12/01/2026] 

* Started Sprint 4 implementation on branch `feature/caregiver-patient-management`, focusing on completing the caregiver-facing patient management workflow end-to-end (UI, backend integration, validation and feedback).
* Implement Patient Management Interface (Issue #9)
  * Implemented caregiver patient list UI including search/filtering, patient cards, and a consistent details modal.
  * Added clear Active/Archived status indicators and ensured UI state remains consistent with backend archiving rules.
  * Verified data isolation (caregivers only view assigned patients) and ensured archived patients are separated from active lists.
  * Supporting implementation commit:
    * `64fea9b0` – added caregiver patient list, details view, archive/unarchive flows and UI consistency improvements.
* Add/Edit Patient Profile (Issue #10)
  * Implemented *Add Patient* and *Edit Patient* modal flows with persisted updates and automatic UI refresh after save.
  * Added consistent validation rules to align with registration standards:
    * Name length requirements
    * Email format validation + duplicate email handling (409 conflict surfaced to UI)
    * Password complexity rules (create flow)
    * Required patient profile fields (emergency contact and medical conditions)
    * Improved date-of-birth UX and validation (valid date range and improved picker behaviour)
  * Added success/error feedback via toast notifications for:
    * create, update, archive, and unarchive actions.
  * Supporting commits:
    * `0fc822e5` – implemented Add/Edit Patient flows (modal form) with backend integration
    * `365aeba1` – fixed remaining Issue #10 problems and stabilised validation and UI behaviour

* Dashboard integration and consistency improvements

  * Connected the *Dashboard “+ Add Patient”* button to open the same patient creation flow used in Patient Management (via navigation to the Patients page and triggering the modal).
  * Added a small “My Patients” preview section on the dashboard for consistency, plus a clear *“View all”* link to Patients.
  * Standardised icon styling across dashboard/patient management by replacing inconsistent emoji-based icons with clean open-source icons.
  * Supporting commit:
    * `7009e48a` – updated KPI/icon UI using `lucide-react` for a consistent, professional look
* Testing and verification outcomes
  * Initial UI testing identified a failure in patient creation when required fields were missing (form blocked submission without clear validation feedback).
  * Implemented fixes so validation errors are displayed consistently, duplicate-email errors are surfaced clearly, and all form fields provide actionable feedback.
  * Re-tested create/update/archive/unarchive workflows; confirmed **no visible UI issues**, correct API responses, and successful UI refresh after mutations.
  * Posted progress updates on GitLab issues and moved Issue #9 and Issue #10 through In Progress → Testing → Review → Done with commit references and evidence.

## Week 15 [w/c 19/01/2026]

* Continued Sprint 4 development on branch `feature/reminder-scheduling-ui` with a focus on completing and validating the Reminder Scheduling functionality within the caregiver dashboard.
* Reminder Scheduling – Create/Edit/Delete & Recurrence (Issue #11) [Completed]
* Fully implemented reminder scheduling functionality, allowing caregivers to:
  * Create reminders with defined types (medication, appointment, task)
  * Edit and delete existing reminders
  * Configure recurrence patterns consistent with backend data formats
  * Ensured immediate UI updates across reminder list views following create, update, or delete actions.
  * Implemented comprehensive client-side validation to prevent invalid dates/times and missing required fields.
  * Verified correct integration with the backend reminder management API.
  * Supporting implementation commits:
    * `fb32bcd1` – implemented reminder scheduling UI with CRUD, recurrence, and validation
    * `3e2f6beb` – fixed reminder scheduling behaviour and aligned UI with Patient Management
    * `42713778` – added reminder duration/end-date support and refined scheduling logic
  * Issue #11 was reviewed, verified through manual testing, and moved to Done.
  

* Reminder Calendar View (Issue #12)
  * Implemented a calendar-based visualisation for reminders to improve clarity when managing multiple scheduled events.
  * Added colour-coded calendar entries to distinguish reminder types at a glance.
  * Improved calendar interactions, including patient filtering and clearer date selection.
  * Ensured consistency between calendar view and reminder list view.
  * Supporting implementation commit: 
    * `b191f893` – added calendar component to reminders page
  * The calendar functionality has been moved to Testing pending further verification and refinement.
  * Testing, debugging, and stabilisation
    * Conducted manual UI-level testing across reminder creation, editing, deletion, and recurrence scenarios.
    * During testing, identified inconsistent behaviour in patient creation that affected reminder assignment flows.
    * Investigated and resolved the issue to ensure stable interaction between patient management and reminder scheduling.
    * Supporting bug-fix commit:
      * `89ca5e3a` – fixed inconsistent patient creation behaviour identified during reminder-related testing
    * Verification outcomes
        * Correct validation and error feedback for reminder forms
        * Immediate UI refresh after reminder mutations
        * Stable end-to-end caregiver workflow from patient selection to reminder scheduling
* Updated GitLab issues with evidence and commit references, reflecting accurate status progression across In Progress → Testing → Review → Done where applicable.

Sprint 4 reminder scheduling functionality is now largely complete, with core CRUD and recurrence features signed off and the calendar view undergoing final testing and validation.


## Week 16 [w/c 26/01/2026]

- Started sprint 5 development with a focus on completing and stabilising the Activity Monitoring feature set, covering backend aggregation APIs, UI charts, and activity logs to provide caregivers with meaningful insights into patient adherence and behaviour.

 *Activity Monitoring – Backend APIs (Issues #14 & #16)*

- Implemented the Activity Summary API to provide chart-ready aggregates for the Activity Monitoring page.
  - Added authenticated endpoint `GET /api/activity/summary` with strict caregiver-only access and patient assignment enforcement.
  - Designed the response to return:
    - `seriesByDay` (counts per day)
    - `breakdownByType` (counts by reminder type)
    - aggregate totals for the selected date range
  - Implemented recurrence expansion logic (once/daily/weekly) with end-date support to ensure reminder occurrences are counted consistently with calendar and UI behaviour.
  - Introduced inferred status logic for MVP (overdue/pending/completed) to maintain a stable API contract prior to full per-occurrence logging.
  - Verified behaviour using authenticated cURL requests, confirming correct 401 responses without tokens and valid aggregated outputs with correct assignment checks.
  - Issue #14 was reviewed, verified, and moved to Done.
  - Supporting commit: `787b0d9b`

- Implemented a live Activity Log API and UI integration to replace mock data:
  - Added endpoint to return a paginated, filterable list of reminder occurrences for the Activity Monitoring page.
  - Introduced an `ActivityLog` model to track per-occurrence adherence (completed/missed), resolving the limitation of one-time reminder completion flags.
  - Added upsert support for activity logs so adherence data can be recorded reliably.
  - Verified correct behaviour through manual testing, including status updates affecting summary totals.
  - Issue #16 progressed from implementation to Testing, then review.
  - Supporting commit: `1ed72c8b`

*Activity Monitoring – UI & Visualisation (Issues #13 & #15)*

- Finalised the Activity Monitoring page UI, including layout, filters, and integration with live backend data.
  - Ensured consistent styling with Patient Management and Reminder Scheduling pages.
  - Confirmed no visible UI errors during manual testing.
  - Issue #13 reviewed and moved to Done.

- Implemented and refined Activity Charts (adherence trends and reminder type breakdown):
  - Integrated summary-driven charts using backend aggregates.
  - Added filters, tooltips, and improved axis labelling for readability.
  - Refined chart layout to prevent label overlap and ensure dates remain fully visible.
  - Conducted UI testing and applied minor visual refinements before review.
  - Issue #15 moved to Review following UI improvements.
  - Supporting commits:
    - `6e0c01d6` – summary-driven charts with filters and tooltips
    - `6d87db90`, `a09bd082` – UI refinements for chart readability

*Patient Profile & Management Refinements (Usability & Data Integrity)*

- Refined the patient create/edit workflow to improve usability and data quality, incorporating supervisor feedback:
  - Reorganised the form into clearly defined sections (Personal, Medical, Medical History, Care & Emergency) using a tabbed modal to reduce cognitive load.
  - Structured Medical History inputs to better reflect real clinical records.
  - Converted chronic conditions from free-text into a structured, repeatable list with optional diagnosis dates.
  - Made Diagnosis mandatory while keeping Medical History optional to avoid blocking patient registration when information is incomplete.
  - Strengthened validation rules for names (preventing numeric input while allowing real-world punctuation such as hyphens and apostrophes).

- Ensured backend models and persistence logic correctly store and retrieve all new fields, preventing partial-update overwrites and data loss.
- Aligned View Details layout with Edit Profile for consistency and improved caregiver workflow efficiency.

*Dashboard Consistency & Stability Improvements*

- Updated dashboard patient cards to visually and structurally match Patient Management views.
- Limited dashboard previews to three patients for clarity while preserving quick navigation to full management.
- Refactored shared helper utilities (e.g., age calculation, formatting) to reduce duplication and prevent runtime errors.
- Fixed a dashboard runtime error related to helper imports, improving overall system stability.

Sprint 5: Activity Monitoring & Reporting Charts (Phase 2)  largely complete, with backend aggregation, live activity logging, and visual analytics implemented and verified. Remaining work focuses on final chart review feedback and continued integration testing across caregiver workflows.

## Week 17 [w/c 02/02/2026]

- Moved to `Done` and completed rest of issues on Sprint 5
- Started Sprint 6 work on location and safe zones, implementing backend APIs and caregiver-facing map UI.

*Location Tracking API (Issue #19)*

- Implemented the Location Tracking API with consent and caregiver access control:
  - Added endpoints to receive and store patient location updates with proper ownership checks.
  - Ensured only assigned caregivers can access a patient’s location data.
  - Integrated consent flags so location sharing respects patient preferences.
  - Supporting commit: `cbdeb123`

*Safe Zones CRUD API*

- Added full Safe Zones API for caregivers:
  - Create, read, update, and delete safe zones per patient.
  - Stored zone geometry (centre, radius) and metadata in the database.
  - Enforced caregiver–patient assignment on all safe zone operations.
  - Supporting commit: `a3123af2`

*Geofencing and Location Alerts*

- Implemented geofencing logic to evaluate whether a patient is inside or outside their safe zones on each location update.
  - Added logic to detect transitions (entering/leaving zones) and persist alert records.
  - Wired geofencing checks to run on location update so alerts are generated in real time.
  - Supporting commits: `43cac074`, `e7a15a1a`

*Caregiver Map UI and Location Page*

- Built the caregiver-facing location page with map integration:
  - Display of patient location and safe zones on the map.
  - Caregiver-friendly controls to add, edit, and remove safe zones (radius, centre).
  - Clear visual distinction between zones and current position.
  - Supporting commits: `b00e01cb`, `d5a56fd8`
- Added CSS and layout improvements to the location page (Issue #20). Commit: `d5a56fd8`

*Dashboard and Documentation*

- Displayed location alerts (e.g. “left safe zone”) on the dashboard and Location page so caregivers see at-a-glance status.
- Documented map implementation and setup in the project docs. Commits: `89b2ff66`, `9d4eaebc`

*Stability and Merge*

- Resolved merge conflicts after integrating `feature/activity-monitoring` into `develop` (commits: `69320a48`, `c7966f37`).
- Applied UI tweaks to the activity graph (bar label positioning, date visibility) to improve readability. Commits: `a09bd082`, `6d87db90`.

*Sprint 6: Location – Issue Closure and Verification*

- Closed Sprint 6 issues #17–#21 after verification:
  - #17 (Location Tracking API): Passed manual cURL tests; consent and caregiver checks confirmed.
  - #18 (Safe Zones CRUD): Verified with cURL scripts; CRUD operations and geometry storage correct.
  - #19 (Geofencing Checks & Alerts): Tested transitions (entering/leaving zones); alerts generated as expected.
  - #20 (Location Monitoring Page): Tested; improved by adding alerts when patient returns to safe zone.
  - #21 (Display Location Alerts in Dashboard): Completed; alerts visible on dashboard and Location page.

## Week 18 [w/c 09/02/2026]

- Finalised dashboard and documentation ahead of the patient app sprint; improved patient details and caregiver experience.

*Dashboard and Patient Details*

- Delivered final dashboard refinements before shifting focus to the mobile patient app:
  - Aligned dashboard layout and behaviour with the rest of the caregiver workflow.
  - Improved Patient Details by adding an activity summary section (e.g. recent adherence, reminder completion) so caregivers get a quick view of patient engagement.
  - Supporting commits: `de84bdd9`, `4dcc6361`

*Documentation and Backend Setup*

- Expanded BackendSetUp.md with clearer instructions for environment variables, database setup, email configuration (SMTP, PATIENT_APP_URL, FRONTEND_URL), and API usage. Commit: `7e4b2c94`
- Added Caregiver dashboard documentation. Commit: `e4e5e08b`

*Email Verification for Signups*

- Implemented email verification for new caregiver signups:
  - Backend sends a verification link after registration; users must open it before they can log in.
  - Login returns a clear error when the account is not yet verified, with option to resend the verification email from the login page.
  - Supporting commit: `72a8aa4b`

*Settings and Navigation*

- Added a Settings section in the dashboard so caregivers can manage account preferences and related options. Commit: `e05774d2`
- Improved the sidebar layout and navigation for consistency before moving on to the patient app. Commit: `051942e6`

*Location Page Improvements*

- Further improved the location page layout, controls, and integration with safe zones and alerts. Commit: `ff45acf4`

**Started Sprint 7: Patient PWA Interface & Reminders (Phase 3).** Created milestone and branch `feature/patient-app`; deleted `feature/patient-management` after consolidation. Opened issues #22–#30 to track scaffold, manifest, login/activate, post-login shell, reminders list, mark complete, overdue UX, and invite integration.

*Patient PWA Scaffold and Routing (Issue #22) [Done]*

- Created the patient app as a React + Vite PWA in the `patient-app` directory:
  - Set up routing for login, activate, home, and reminders.
  - Added protected routes so only authenticated patients see the main app.
  - Established a simple layout and styling foundation for subsequent features.
  - Supporting commit: `4eb28810`

*Web App Manifest (Issue #24) [Done]*

- Added a web app manifest (name, short_name, icons, start_url, display: standalone) to support “Add to Home Screen” and standalone launch. Commit: `d63612d7`
- Verified by testing Add to Home Screen on an iPhone over the local network; the app installs and launches correctly in standalone mode.
- Served the manifest with `Content-Type: application/manifest+json` in the Vite dev server to resolve a Chrome “Manifest: Syntax error” warning; formatted the manifest as valid JSON. Later adjusted dev server and cache behaviour as needed.

*Patient Login and Activate (Passwordless Email Links) – Issue #25*

- Implemented full passwordless authentication for patients:
  - **Activate (invite link):** Caregiver invites create a patient user and send an email with a link to `/activate?token=...`. The activate page calls the backend to validate the token, activate the account, and log the user in.
  - **Request login link:** On the login page, the patient enters their email; the backend sends a magic link to `/login?token=...`. Opening that link verifies the token and logs the user in.
  - Backend endpoints: `POST/GET /api/auth/activate`, `POST /api/auth/patient/request-login`, `POST /api/auth/patient/verify-link`, with correct ownership and expiry checks.
  - Supporting commit: `a025a74d`

*Debugging: API Endpoint Not Found and Activation*

- During testing, the patient app showed “API endpoint not found” when requesting a login link or opening the activate link. Investigation showed:
  - The backend catch-all 404 returns that message when no route matches; the request was reaching the server but the route was not registered (e.g. backend not restarted after adding patient auth routes), or the request URL was wrong.
  - **Double /api in URL:** When `VITE_API_BASE` was set to e.g. `http://localhost:5001/api`, the app was building URLs as `API_BASE + path`, producing `/api/api/auth/...` and triggering 404. Fixed by normalising the API base in the client (strip trailing `/api` when building the request URL) so activation and login requests hit the correct endpoints.
  - **Stale UI (placeholder “Issue 1.3”):** Some browsers continued to show an old placeholder activation/login UI from cache. Addressed by: running the patient app on a different port (5175) so the browser had no cached content for that origin; unregistering service workers in development; and ensuring the dev server sends cache-control headers. The patient app was later set to run on port 5175 by default so invite and magic-link emails work without cache issues. Documented that clearing site data for the patient app origin resolves the issue if it recurs.

*Testing on Phone (Network Access)*

- Enabled testing the patient app on a phone on the same Wi‑Fi:
  - Set Vite dev server to `host: true` so it binds to the network and displays a Network URL (e.g. `http://192.168.x.x:5175`).
  - For activation and magic links to work on the phone, `PATIENT_APP_URL` in the backend must be set to the machine’s network URL (e.g. `http://192.168.x.x:5175`), not `localhost`, so links in emails open the app on the phone correctly. Documented this in BackendSetUp.md.

*Post-Login Shell, Logout, and Base Accessibility*

- Implemented the post-login shell and baseline accessibility (interim report requirements):
  - **Shell:** After login, the user sees a consistent shell: header with app name “NeuroEase”, main content area, and bottom navigation (Home, Reminders). Implemented in `Layout.jsx` with `ProtectedRoute` wrapping authenticated routes.
  - **Logout:** “Log out” in the header calls the auth context’s `logout()` (clears stored token and user state), then redirects to `/login` with `replace: true`, so the session is fully cleared.
  - **Accessibility:** Applied WCAG AA–oriented contrast (e.g. dark text on light background, primary colour on white). Set a minimum touch target size of 44×44px via CSS variable `--pa-touch-min` for buttons, nav links, and form controls. Ensured the viewport allows zoom (`user-scalable=yes`, `maximum-scale=5.0`); used `rem` for font sizes and avoided blocking zoom. Added visible focus indicators (`:focus-visible`) on buttons, links, and inputs; added a “Skip to main content” link to `#pa-main` for logical focus order on login, activate, and shell.
  - Supporting commit: `204aab7c`

*Verification and Issue Progression*

- Confirmed: logged-in users see the same shell on Home and Reminders; logout clears the session and redirects to login; key interactive elements meet the minimum touch target and contrast; page zoom does not break layout; tab/focus order is logical on login, activate, and the main shell.
- Issue #22 (scaffold): Implemented → Testing → Done. Issue #24 (manifest): Implemented → verified on iPhone → Done. Issue #25 (login/activate): Implemented → passed testing → Review → Done. Issue #26 (post-login shell): Implemented → Testing → Done.

---

## Week 19 [w/c 16/02/2026]

- Continued Sprint 7 Patient PWA development on branch `feature/patient-app`. Focused on making the reminders list fully functional and completion flows reliable. Issues #27, #28, and #29 were implemented, tested, and moved to Done.

*Reminders List – Fetch and Display (Issue #27) [Done]*

- Implemented fetch and display of the reminders list so patients see their scheduled reminders at a glance:
  - Integrated `GET /api/reminders/patient/:patientId` to load the logged-in patient’s reminders on mount.
  - Displayed each reminder with time, title, type (medication, appointment, task), recurrence label (e.g. “Daily”), and clear visual grouping.
  - Added loading skeleton and empty state (“No reminders”) so users always get clear feedback rather than a blank screen.
  - Ensured layout is responsive and touch-friendly for mobile use.
  - Supporting commit: `ec5a7e9c`

*Mark Reminders as Complete (Issue #28) [Done]*

- Implemented mark-as-done functionality with backend persistence:
  - Patients tap a reminder to mark it complete; the app sends `PUT /api/reminders/:id` with `isCompleted: true` and `completedAt` (timestamp).
  - UI updates immediately via local state; no full reload required.
  - Success feedback via a short-lived completion modal so users know the action succeeded.
  - During testing, an error was identified and fixed (see completion-per-occurrence fix below).
  - This was essential for adherence tracking: caregivers rely on completion data in the Activity feed and dashboard.
  - Supporting commit: `4a8836cb`

*Completion per Occurrence for Daily/Weekly Reminders (Critical Fix)*

- Fixed a limitation discovered during Issue #28 testing: previously, marking one occurrence complete could hide or misrepresent the rest of the series.
  - For daily/weekly reminders, completion is now tracked per occurrence using `completedAt` and the occurrence date (same calendar day).
  - One-time reminders continue to use the global `isCompleted` flag.
  - The reminders list correctly shows which occurrences are done vs pending (e.g. “Done today” vs “Due today”).
  - This fix underpins accurate adherence reporting for caregivers and reduces confusion for patients with recurring medications or appointments.
  - Supporting commit: `eff2a4b4`

*Overdue Highlighting and Reminder List UX (Issue #29) [Done]*

- Improved the overdue reminder UI for clearer visual distinction and usability:
  - During testing, orange for overdue was found confusing when medication reminders used red—particularly for older users, where red can convey urgency. Adjusted the colour scheme to avoid overlap and clarify meaning.
  - Overdue reminders are visually distinct so they stand out from due-today and upcoming items.
  - List is organised by section (Overdue, Today, Upcoming) so users can prioritise what needs attention first.
  - Touch targets and spacing aligned with accessibility guidelines.
  - Supporting commits: `eff2a4b4` (completion per occurrence, moved to Testing), `4e3899a4` (overdue UI update); issue moved to Done after review.

*Code Quality and Documentation*

- Added inline comments and fixed a minor error in the patient app. Commit: `2edeb125`


---

## Week 20 [w/c 23/02/2026]

- Delivered two major pieces that complete the caregiver–patient onboarding flow and enable proactive reminder delivery. Issues #30 and #31 implemented and moved to Done.

*Dashboard Invite Link Integration (Issue #30)*

- Completed invite link integration so caregivers can bring patients into the app without manual account setup:
  - Progression: Implemented → moved to Testing → passed testing → moved to Review.
  - Caregivers generate invite links from the dashboard; each link embeds an activation token tied to the patient user.
  - Invite links open the patient app’s `/activate?token=...` page; the backend validates the token, activates the account, and logs the user in.
  - Patients never need a password: activation and subsequent logins use magic-link style flows.
  - This was a critical usability improvement: it removes friction for elderly users and caregivers who support them.
  - Supporting commit: `b369266d`

*Reminder Notifications by Email (Issue #31)*

- Implemented the first reminder notification channel so users are proactively notified of upcoming reminders:
  - Documented implementation summary and testing summary in issue comments; ready for Review.
  - Backend reminder job runs every minute, queries due and unsent reminders, and sends emails per patient’s `reminderNotificationChannel` preference.
  - Patients configure their preference in Profile: Email, In-app push, or None.
  - Email content includes reminder title, message, and scheduled time, plus a prompt to open the app.
  - Supports one-time, daily, and weekly recurrence; uses `reminderEmailSentAt` to avoid duplicate sends for the same occurrence.
  - Overdue follow-up: if a reminder is still incomplete 15 minutes after due, a second email is sent (stored in `overdueNotificationSentAt`).
  - Supporting commit: `a95f3782`

---

## Week 21 [w/c 02/03/2026]

- Delivered in-app push notifications and voice-assist for reminders, extending notification options and accessibility. Opened Issue #32 (push) and #33 (voice-assist); both implemented and moved to Done.

*Reminder Notifications by In-App (Web) Push (Issue #32)*

- Implemented reminder delivery via Web Push so users get notifications even when the app is in the background:
  - Patients select “In-app push” in Profile; the browser’s Push API is used to subscribe, and the subscription (endpoint, keys) is stored per user in the backend.
  - Backend reminder job sends push payloads via the Web Push API using VAPID keys; each payload includes title, body, and reminderId.
  - Service worker (`sw.js`) receives push events, displays a system notification, stores the reminder in IndexedDB for voice-assist, and can notify open client windows via `postMessage`.
  - This is especially important for mobile: users who add the app to their home screen receive native-style notifications when reminders are due.
  - Supporting commit: `bd142846`

*Voice-Assist Reminders When Push Is Received (Issue #33)*

- Added voice-assist so reminders can be read aloud, improving accessibility for users with visual impairment or cognitive difficulties:
  - Documented implementation summary and verification steps in issue comments.
  - When a push arrives and the app is already open, the reminder is spoken immediately via the Web Speech API (`speechSynthesis`).
  - When the user opens the app by tapping a notification, the pending reminder is stored in IndexedDB; on load, the app retrieves it and speaks it aloud.
  - Profile section for Voice Assist: enable/disable, voice selection (system voices), and speech rate (Slower, Normal, Faster).
  - Research supports that multimodal cues (audio + visual) improve task completion for people with dementia; this aligns with design goals in CognitiveGames_Dementia.md.
  - Supporting commit: `e8f9cf40`

---

## Week 22 [w/c 09/03/2026]

- Opened **Sprint 8: Cognitive Games (Phase 3)** milestone and issues #34–#39. Implemented Memory Match (#34) and Math Practice (#35), fixed recurring reminder push bug, and addressed Memory Match UI feedback from testing.

*Games Section and Navigation*

- Added Games to the patient app bottom navigation and created a Games list page (`/games`):
  - Patients can tap Games to see available cognitive activities; each game is a card with icon, title, and short description.
  - Routes: `/games/memory` for Memory Match, `/games/math` for Math Practice.
  - Design aligns with dementia-friendly principles: large touch targets, clear labels, minimal clutter.

*Memory Match Cognitive Game (Issue #34)*

- Implemented Memory Match as the first cognitive game with full backend integration:
  - During testing, inconsistencies and flaws in the user interface were identified (e.g. victory overlay appearing before last card flip, unclear quit/done controls). These were fixed in follow-up work.
  - Ported from DementiaGames (card_memory_game_fruits) with React; 4×4 grid of fruit cards, flip-to-match pairs.
  - Dementia-friendly design: large cards, full-width grid with minimal gaps, 44px minimum touch targets, high contrast.
  - Features: start overlay, Pause/Resume, timer, moves counter, victory screen. Added a 1.5s delay before the victory overlay so users see the last pair flip and match—important for a sense of completion.
  - Victory sound plays when all pairs are matched; sound can be toggled in Profile (Game sound effects).
  - Backend: `POST /api/games` saves sessions with `gameType: 'memory'`, score (moves), duration, and accuracy for caregiver visibility in the Activity feed.
  - Supporting commit: `d50f2b00`
  - Opened follow-on issues #37 (show game sessions in Patient Activity Modal), #38 (add game sessions to Activity page feed), #39 (Games charts and data summary) to connect games to the caregiver dashboard.

*Math Practice Cognitive Game (Issue #35)*

- Implemented Math Practice and added it to the Games list:
  - Ported from DementiaGames (mathGame 2); supports add, subtract, multiply, and divide with dementia-friendly equation display.
  - Each question shows a simple equation (e.g. 5 + 3 = ?) and three shuffled answer options; correct/incorrect feedback includes hints.
  - Sound feedback (correct/wrong) aligns with research: “feedback prompts for every action performed are critical for successful perception and task completion” (Frontiers in Sports and Active Living, 2024).
  - Session features: timer, Pause/Resume, End session button that shows a summary (“You completed X questions. Time: MM:SS”) before returning to Games.
  - Profile toggle for game sound effects applies to both games.
  - Route `/games/math`; Math Practice card in Games list.
  - Supporting commit: `5e1f504d`
  - Opened Issue #36 (Math Game backend integration and UX polish) for follow-on refinements.

*Recurring Reminders, Push and Email Notification Bug Fix [Critical]*

- Fixed a bug where in-app push and email notifications stopped for recurring appointments or daily reminders after the first occurrence or first completion:
  - **Root cause:** The reminder job filtered with `where: { isCompleted: false }`. When a patient marked a recurring reminder complete for one day, `isCompleted` was set to true and the reminder was excluded from all future job runs. Daily and weekly reminders thus stopped receiving notifications entirely.
  - **Fix:** Include recurring reminders in the job regardless of `isCompleted`. The `isDueAndUnsent` logic already prevents duplicate sends per occurrence (using `reminderEmailSentAt` for daily, and per-week checks for weekly). Only one-time reminders are excluded when completed.
  - **Enhancement:** Added `endTime` checks so notifications are not sent for occurrences after the reminder’s end date.
  - This fix restores reliable notification delivery for daily medications, recurring appointments, and other recurring reminders, a core requirement for patient adherence.
  - Supporting commit: `a4065418`

*Documentation*

- Updated CognitiveGames_Dementia.md with design rationale and evidence:
  - Victory delay: why users need to see the last pair before the celebration overlay.
  - Sound feedback: research reference and rationale for correct/wrong sounds in Math; no sound on card mismatch in Memory (to avoid discouragement).
  - Profile sound-effects toggle: how it applies across games and why it matters for accessibility.

*Sprint 8 Issue Board*

- Sprint 8 issues created: #34 (Memory Match), #35 (Math Game), #36 (Math Game backend/UX), #37 (Patient Activity Modal, real game sessions), #38 (Activity page feed – game sessions), #39 (Games charts and data summary).
