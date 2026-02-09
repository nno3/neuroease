import { api } from "./apiClient";

export function getLatestLocation(patientId) {
    return api.get(`/location/latest?patientId=${encodeURIComponent(patientId)}`);
}

export function getSafeZones(patientId) {
    return api.get(`/safe-zones?patientId=${encodeURIComponent(patientId)}`);
}

export function createSafeZone(patientId, { name, centerLat, centerLng, radius }) {
    return api.post("/safe-zones", { patientId, name, centerLat, centerLng, radius });
}

export function updateSafeZone(zoneId, { name, centerLat, centerLng, radius }) {
    return api.put(`/safe-zones/${zoneId}`, { name, centerLat, centerLng, radius });
}

export function deleteSafeZone(zoneId) {
    return api.delete(`/safe-zones/${zoneId}`);
}

export function getLocationAlerts(patientId) {
    return api.get(`/location/alerts?patientId=${encodeURIComponent(patientId)}`);
}

/** Recent location alerts for all of the caregiver's patients (last 7 days). For dashboard. */
export function getLocationAlertsForCaregiver() {
    return api.get("/location/alerts");
}

/** Dashboard: alerts + patients currently outside any safe zone. */
export function getLocationStatusForCaregiver() {
    return api.get("/location/status");
}
