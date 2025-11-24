## Development Process & Definition of Done (DoD)

This project follows a lightweight Scrum framework with 2–3 week sprints.  
Work is organised using GitLab issues, milestones (sprints), and an issue board to visualise progress
(**To Do → In Progress → Testing → Review → Done**).

### Global Definition of Done

An issue is only moved to **Done** on the GitLab board when all of the following are true:

- The feature or fix has been fully implemented.
- The code compiles/runs without errors.
- Manual tests have been performed (e.g. using curl/Postman or the UI) and behave as expected.
- There are no known high-priority bugs directly caused by this change.
- All relevant code has been committed and pushed to GitLab.
- Any necessary documentation has been updated.

### Backend Feature DoD (APIs & Services)

For backend-related issues (e.g. authentication, patient management, reminders, monitoring, location), the Definition of Done includes:

- All required endpoints are implemented and correctly wired to the database.
- Authentication and role-based access control are enforced where necessary.
- Input validation and basic error handling are implemented; invalid requests return meaningful error responses.
- API responses follow a consistent JSON structure (`success`, `message`, optional `data` / `errors`).
- Manual tests for each endpoint have been performed (curl/Postman).

### Frontend Feature DoD (Dashboard & Patient App)

For frontend-related issues (caregiver dashboard, patient PWA), the Definition of Done includes:

- UI layout is responsive for the target device(s) (desktop for dashboard, mobile for patient app).
- Core user flows for the story or issue are implemented end-to-end against the live API.
- Accessibility basics are respected for patient application (sufficient contrast, clear labels, keyboard/touch navigation).
- Error and loading states are handled.
- Manual testing performed in at least two browsers (e.g. Chrome + Firefox/Safari).
- Any new components or pages are linked into the navigation and are reachable from the main UI.

