import { api } from "./apiClient";

export const getPatients = () => api.get("/patients"); // active only
export const getArchivedPatients = () => api.get("/patients/archived"); // archived only

export const archivePatient = (id, payload) => api.post(`/patients/${id}/archive`, payload);
export const unarchivePatient = (id, payload) => api.post(`/patients/${id}/unarchive`, payload);
