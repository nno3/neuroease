# Usability Testing Setup

This document describes the changes made to support **usability testing** of NeuroEase without requiring real login or real GPS. 

---

## What Changes in Test Mode

### Patient app

- **Login page**: Shows a "Skip to testing" button. Clicking it logs in as the test patient without email.
- **Location sharing (Profile)**: Instead of real GPS, testers pick from preset locations:
  - Home, Park, Supermarket, Pharmacy, Café, Outside safe zone
- **No device location permission** is requested in test mode.

### Caregiver dashboard

- **Add/Edit patient**: Disclaimer under the email field: *"Use a valid email address the patient can access. They need it to log in (magic link or code)."*

---

## Why These Changes Were Made

| Change | Reason |
|--------|--------|
| **Skip login** | Testers can start using the app immediately without email verification or magic links. Reduces friction and speeds up testing sessions. |
| **Simulated locations** | Avoids requesting device location permission and protects tester privacy. Testers can choose preset locations (Home, Park, Supermarket, etc.) to simulate different scenarios (e.g. leaving a safe zone). |
| **Email disclaimer** | Reminds caregivers to use a valid, accessible email when registering patients. Patients need that email to log in (magic link or code). Reduces support issues and failed logins. |

---


## Simulated Locations (Coordinates)

| Location | Approx. area |
|----------|--------------|
| Home | Cambridge, UK |
| Park | Cambridge, UK |
| Supermarket | Cambridge, UK |
| Pharmacy | Cambridge, UK |
| Café | Cambridge, UK |
| Outside safe zone | Farther away (for testing "left safe zone" alerts) |

These are defined in `patient-app/src/services/locationService.js` (`SIMULATED_LOCATIONS`).
