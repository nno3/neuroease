# Usability Testing Setup

This document describes the changes made to support **usability testing** of NeuroEase without requiring real login or real GPS. It also documents the email disclaimer and how to run a separate testing copy.

---

## Why These Changes Were Made

| Change | Reason |
|--------|--------|
| **Skip login** | Testers can start using the app immediately without email verification or magic links. Reduces friction and speeds up testing sessions. |
| **Simulated locations** | Avoids requesting device location permission and protects tester privacy. Testers can choose preset locations (Home, Park, Supermarket, etc.) to simulate different scenarios (e.g. leaving a safe zone). |
| **Email disclaimer** | Reminds caregivers to use a valid, accessible email when registering patients. Patients need that email to log in (magic link or code). Reduces support issues and failed logins. |

---

## Should You Copy the Project or Use a Branch?

**Recommended: Git branch**

```bash
git checkout -b usability-testing
# Make the changes (or they're already in this branch)
# Deploy this branch for testing
```

- Same codebase, easy to merge fixes back
- Switch between testing and production with `git checkout`

**Alternative: Copy folder**

```bash
cp -r na429 na429-testing
cd na429-testing
# Use different .env (different DB, TEST_PATIENT_ID, etc.)
```

- Fully isolated; won't affect the main project
- Harder to keep in sync; changes must be manually copied

---

## Setup for Usability Testing

### 1. Backend

Add to `backend/.env`:

```env
USABILITY_TESTING=1
TEST_PATIENT_ID=<user_id_of_test_patient>
TEST_CAREGIVER_ID=<user_id_of_test_caregiver>
```

- **TEST_CAREGIVER_ID**: Register a caregiver account (normal sign-up), then use that user's **User ID** from the database as `TEST_CAREGIVER_ID`. The "Testing" button on the caregiver dashboard login will use this account.
- **TEST_PATIENT_ID**: Create a test patient in the caregiver dashboard first. Use that patient's **User ID** (not the Patient profile ID) as `TEST_PATIENT_ID`. Assign the test patient to the test caregiver so you can see their data.

### 2. Patient app

Add to `patient-app/.env` (or set when building):

```env
VITE_USABILITY_TESTING=1
```

Build and run:

```bash
cd patient-app
VITE_USABILITY_TESTING=1 npm run build
# or for dev: VITE_USABILITY_TESTING=1 npm run dev
```

### 3. Caregiver dashboard

Add to `caregiver-dashboard/.env`:

```env
VITE_USABILITY_TESTING=1
```

Restart the dev server after adding. This enables:
- **Top banners**: Content notice (purple) and usability testing instructions (blue)
- **Patient form**: Email disclaimer when adding/editing a patient
- **Location page**: Simulated-locations-only warning (amber)

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

## Disabling Test Mode

- Remove `USABILITY_TESTING=1`, `TEST_PATIENT_ID`, and `TEST_CAREGIVER_ID` from backend `.env`.
- Remove `VITE_USABILITY_TESTING=1` from patient app (or rebuild without it).
- Remove `VITE_USABILITY_TESTING=1` from caregiver dashboard `.env` (or rebuild without it).
- The "Skip to testing" button, simulated locations, and dashboard disclaimers will no longer appear.

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
