import { api } from "./apiClient";

export function getLatestLocation(patientId) {
    return api.get(`/location/latest?patientId=${encodeURIComponent(patientId)}`);
}

export function getSafeZones(patientId) {
    return api.get(`/safe-zones?patientId=${encodeURIComponent(patientId)}`);
}

export function getLocationAlerts(patientId) {
    return api.get(`/location/alerts?patientId=${encodeURIComponent(patientId)}`);
}
