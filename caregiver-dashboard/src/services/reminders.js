import { api } from "./apiClient";

export const getRemindersForPatient = (patientId) => {
    return api.get(`/reminders/patient/${patientId}`);
};

export const createReminder = (payload) => {
    return api.post("/reminders", payload);
};

export const updateReminder = (id, payload) => {
    return api.put(`/reminders/${id}`, payload);
};

export const deleteReminder = (id) => {
    return api.delete(`/reminders/${id}`);
};