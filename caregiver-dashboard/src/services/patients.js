import { api } from "./apiClient";

export const getPatients = () => api.get("/patients"); // active only
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const getArchivedPatients = () => api.get("/patients/archived"); // archived only

export const createPatient = (payload) => api.post("/patients", payload);

export const updatePatient = (id, payload) => api.put(`/patients/${id}`, payload);
export const archivePatient = (id, payload) => api.post(`/patients/${id}/archive`, payload);
export const unarchivePatient = (id, payload) => api.post(`/patients/${id}/unarchive`, payload);
