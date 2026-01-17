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

## Week 14 [w/c 13/01/2026] 

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
