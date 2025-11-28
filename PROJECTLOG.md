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

