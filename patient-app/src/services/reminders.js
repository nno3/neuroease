/**
 * Patient reminders – fetch list for the logged-in patient.
 * GET /api/reminders/patient/:patientId (patientId = user.id); backend enforces ownership.
 */
import { apiRequest } from "./apiClient";

/**
 * @param {number} patientId - Logged-in patient's user id
 * @returns {Promise<{ id: number, title: string, message: string, reminderType: string, scheduledTime: string, recurrence: string, endTime?: string, isCompleted: boolean }[]>}
 */
export async function getRemindersForPatient(patientId) {
  const data = await apiRequest(`/api/reminders/patient/${patientId}`);
  if (!data.success || !Array.isArray(data.data)) return [];
  return data.data;
}
