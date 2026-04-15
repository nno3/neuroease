/**
 * Patient reminders – fetch list and mark as done.
 * GET /api/reminders/patient/:patientId; PUT /api/reminders/:id with { isCompleted: true }.
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

/**
 * Mark a reminder as done. Sends completedAt so the backend can record when it was done (for "completed late").
 * Patient can only update their own reminders (backend enforces).
 * @param {number} reminderId
 * @returns {Promise<{ success: boolean, data?: object }>}
 */
export async function markReminderComplete(reminderId) {
  return apiRequest(`/api/reminders/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify({
      isCompleted: true,
      completedAt: new Date().toISOString(),
    }),
  });
}
