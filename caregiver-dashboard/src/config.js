/**
 * Usability testing configuration.
 * Set VITE_USABILITY_TESTING=1 and optionally VITE_MAX_PATIENTS_TESTING=N in .env.
 * VITE_TEST_CAREGIVER_EMAIL: when set, Settings page is locked for this account (no profile/password/delete changes).
 */
export const isUsabilityTesting = import.meta.env.VITE_USABILITY_TESTING === "1";
export const testCaregiverEmail = (import.meta.env.VITE_TEST_CAREGIVER_EMAIL || "test.caregiver@neuroease.test").trim().toLowerCase();
export const maxPatientsForTesting = Math.max(
  1,
  parseInt(import.meta.env.VITE_MAX_PATIENTS_TESTING || "5", 10) || 5
);

/**
 * When in usability testing mode, limit the patient list to keep tests manageable.
 * @param {Array} patients - Full patient list
 * @returns {Array} Sliced list when testing, or full list otherwise
 */
export function limitPatientsForTesting(patients) {
  if (!Array.isArray(patients)) return patients;
  if (!isUsabilityTesting) return patients;
  return patients.slice(0, maxPatientsForTesting);
}
