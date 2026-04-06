import React from 'react';
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw, AlertTriangle, CheckCircle2, Plus, Search, Pencil, Trash2, X, Navigation } from "lucide-react";
import { getPatients } from "../services/patients";
import {
    getLatestLocation,
    getSafeZones,
    getLocationAlerts,
    createSafeZone,
    updateSafeZone,
    deleteSafeZone,
} from "../services/locationService";
import { format3 } from "../utils/patientHelpers";
import "./Location.css";

const DEFAULT_CENTER = [52.52, 13.405];
const DEFAULT_ZOOM = 10;

const CUSTOM_RADIUS = "custom";
// Minimum 10 m: GPS can achieve ±5 m outdoors; 10 m is the lower bound for reliable geofencing
// (Radar, "How accurate is geofencing?" https://radar.com/blog/how-accurate-is-geofencing)
const MIN_RADIUS = 10;
const MAX_RADIUS = 5000;

const RADIUS_OPTIONS = [
    { value: 10, label: "Very small (10 m)" },
    { value: 100, label: "Small (about 100 m)" },
    { value: 200, label: "Medium (about 200 m)" },
    { value: 500, label: "Large (about 500 m)" },
    { value: CUSTOM_RADIUS, label: "Custom (enter distance below)" },
];

function createMarkerIcon(color) {
    return L.divIcon({
        className: "loc-custom-marker",
        html: `<span style="background-color:${color};width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:block"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
}
const iconInside = createMarkerIcon("#22c55e");
const iconOutside = createMarkerIcon("#ef4444");

const isReturnAlert = (a) => (a.message || "").toLowerCase().includes("returned");

/** Format duration in ms as "Xm" or "Xh Ym" for display. */
function formatDurationOutside(ms) {
    if (ms == null || ms < 0 || !Number.isFinite(ms)) return null;
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

const LOC_ALERT_FILTERS = [
    { value: "day", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
];

function filterAlertsByRange(items, range) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const now = new Date();
    let start;
    if (range === "day") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "week") {
        start = new Date(now);
        start.setDate(start.getDate() - 7);
    } else {
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
    }
    return items.filter((a) => {
        const t = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        return t >= start.getTime();
    });
}

/** For a "Returned" alert, find the most recent "Left" for the same patient before it; return duration in ms. */
function getDurationOutsideMs(alerts, returnedAlert) {
    const retTime = returnedAlert.timestamp ? new Date(returnedAlert.timestamp).getTime() : null;
    if (retTime == null) return null;
    const pid = returnedAlert.patientId;
    const leftsBefore = alerts
        .filter((a) => a.patientId === pid && !isReturnAlert(a) && a.timestamp)
        .map((a) => ({ ...a, t: new Date(a.timestamp).getTime() }))
        .filter((a) => a.t < retTime)
        .sort((a, b) => b.t - a.t);
    const left = leftsBefore[0];
    if (!left) return null;
    return retTime - left.t;
}

/** Distance in meters between two (lat, lng) points (Haversine). */
function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** True if (lat, lng) is inside the zone (distance <= radius in meters). */
function isInsideZone(lat, lng, zone) {
    const centerLat = Number(zone.centerLat);
    const centerLng = Number(zone.centerLng);
    const radius = Number(zone.radius);
    if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radius)) return false;
    const dist = haversineMeters(Number(lat), Number(lng), centerLat, centerLng);
    return dist <= radius;
}

function MapFitBounds({ locations, zones }) {
    const map = useMap();
    const bounds = useMemo(() => {
        const points = [];
        locations.forEach((l) => points.push([l.latitude, l.longitude]));
        zones.forEach((z) => points.push([z.centerLat, z.centerLng]));
        if (points.length === 0) return null;
        return L.latLngBounds(points);
    }, [locations, zones]);
    useEffect(() => {
        if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
    }, [map, bounds]);
    return null;
}

function MapClickHandler({ onMapClick, enabled }) {
    useMapEvents({
        click(e) {
            if (enabled && onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function Location() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlPatientId = searchParams.get("patientId");
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState(() => {
        const id = urlPatientId != null ? String(urlPatientId).trim() : "";
        return id && /^\d+$/.test(id) ? id : "all";
    });
    const [locations, setLocations] = useState([]);
    const [zones, setZones] = useState([]);
    const [alertsByPatient, setAlertsByPatient] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const [addZoneMode, setAddZoneMode] = useState(false);
    /** When patient filter is "all", which patient the new zone is for (set in modal). */
    const [addZoneForPatientId, setAddZoneForPatientId] = useState("");
    const [draftZoneCenter, setDraftZoneCenter] = useState(null);
    const [safeZoneForm, setSafeZoneForm] = useState({ name: "Home", radius: 200, customRadius: 200 });
    const [zoneSaving, setZoneSaving] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null);
    const [editZoneForm, setEditZoneForm] = useState({ name: "", radius: 200 });
    const [deletingZoneId, setDeletingZoneId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [alertFilter, setAlertFilter] = useState("week");

    const addZonePanelRef = useRef(null);

    const patientList = useMemo(() => {
        const list =
            patients?.data?.patients ??
            patients?.data?.data?.patients ??
            patients?.data?.data ??
            patients?.data ??
            [];
        return Array.isArray(list) ? list : [];
    }, [patients]);

    const targetIds = useMemo(() => {
        if (patientId === "all") return patientList.map((p) => p.id);
        return [parseInt(patientId, 10)].filter((n) => !Number.isNaN(n));
    }, [patientId, patientList]);

    // Fetch for all selected patients – backend returns last known location even when consent is off (historical data)
    const idsToFetch = useMemo(() => targetIds, [targetIds]);

    const singlePatientId = patientId !== "all" ? parseInt(patientId, 10) : null;
    /** Patient id for the safe zone being added (API allows zones before location sharing is on). */
    const effectiveZonePatientId = useMemo(() => {
        if (patientId !== "all") {
            return singlePatientId != null && !Number.isNaN(singlePatientId) ? singlePatientId : null;
        }
        const n = parseInt(addZoneForPatientId, 10);
        return Number.isNaN(n) ? null : n;
    }, [patientId, singlePatientId, addZoneForPatientId]);
    /** Viewing a single patient: show per-patient zone list and edits. */
    const hasSinglePatientSelected = singlePatientId != null && !Number.isNaN(singlePatientId);

    const zonesForSelectedPatient = useMemo(() => {
        if (singlePatientId == null) return [];
        return zones.filter((z) => z.patientId === singlePatientId);
    }, [zones, singlePatientId]);

    const handleMapClickForZone = useCallback((lat, lng) => {
        setDraftZoneCenter([lat, lng]);
        setSearchResult(null);
    }, []);

    const resetAddZone = useCallback(() => {
        setAddZoneMode(false);
        setAddZoneForPatientId("");
        setDraftZoneCenter(null);
        setSafeZoneForm({ name: "Home", radius: 200, customRadius: 200 });
        setSearchQuery("");
        setSearchResult(null);
    }, []);

    const handleSaveNewZone = useCallback(() => {
        if (!draftZoneCenter || effectiveZonePatientId == null) return;
        const [centerLat, centerLng] = draftZoneCenter;
        const name = (safeZoneForm.name || "Home").trim();
        const radius =
            safeZoneForm.radius === CUSTOM_RADIUS
                ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(safeZoneForm.customRadius) || MIN_RADIUS))
                : (safeZoneForm.radius || 200);
        setZoneSaving(true);
        setError("");
        createSafeZone(effectiveZonePatientId, { name, centerLat, centerLng, radius })
            .then(() => {
                setRefreshKey((k) => k + 1);
                resetAddZone();
            })
            .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to add safe zone"))
            .finally(() => setZoneSaving(false));
    }, [draftZoneCenter, effectiveZonePatientId, safeZoneForm, resetAddZone]);

    const handleSearchPlace = useCallback(() => {
        const q = searchQuery.trim();
        if (!q) return;
        setSearchLoading(true);
        setSearchResult(null);
        fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { Accept: "application/json", "User-Agent": "NeuroEaseCaregiver/1.0" } }
        )
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setSearchResult({ display_name: data[0].display_name, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
                } else {
                    setSearchResult(null);
                    setError("No place found. Try a different address or place name.");
                }
            })
            .catch(() => {
                setSearchResult(null);
                setError("Search failed. You can still click on the map to set the centre.");
            })
            .finally(() => setSearchLoading(false));
    }, [searchQuery]);

    const applySearchResultAsCenter = useCallback(() => {
        if (searchResult) {
            setDraftZoneCenter([searchResult.lat, searchResult.lon]);
            setSearchResult(null);
        }
    }, [searchResult]);

    const handleUpdateZone = useCallback(() => {
        if (editingZoneId == null) return;
        const payload = {};
        if (editZoneForm.name !== undefined) payload.name = editZoneForm.name.trim() || undefined;
        if (editZoneForm.radius != null)
            payload.radius =
                editZoneForm.radius === CUSTOM_RADIUS
                    ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(editZoneForm.customRadius) || MIN_RADIUS))
                    : editZoneForm.radius;
        if (Object.keys(payload).length === 0) {
            setEditingZoneId(null);
            return;
        }
        setZoneSaving(true);
        setError("");
        updateSafeZone(editingZoneId, payload)
            .then(() => {
                setRefreshKey((k) => k + 1);
                setEditingZoneId(null);
            })
            .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to update safe zone"))
            .finally(() => setZoneSaving(false));
    }, [editingZoneId, editZoneForm]);

    const handleDeleteZone = useCallback((zoneId) => {
        if (!window.confirm("Remove this safe zone? You can add it again later.")) return;
        setDeletingZoneId(zoneId);
        setError("");
        deleteSafeZone(zoneId)
            .then(() => setRefreshKey((k) => k + 1))
            .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to remove safe zone"))
            .finally(() => setDeletingZoneId(null));
    }, []);

    useEffect(() => {
        getPatients()
            .then((res) => setPatients(res))
            .catch(() => setPatients([]));
    }, []);

    useEffect(() => {
        const id = urlPatientId != null ? String(urlPatientId).trim() : "";
        if (id && /^\d+$/.test(id)) setPatientId(id);
    }, [urlPatientId]);

    useEffect(() => {
        if (addZoneMode && effectiveZonePatientId != null && addZonePanelRef.current) {
            addZonePanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [addZoneMode, effectiveZonePatientId]);

    useEffect(() => {
        if (targetIds.length === 0) {
            setLocations([]);
            setZones([]);
            setAlertsByPatient({});
            setLoading(false);
            return;
        }
        if (idsToFetch.length === 0) {
            setLocations([]);
            setZones([]);
            setAlertsByPatient({});
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        let cancelled = false;
        const list = patientList;

        Promise.all([
            Promise.all(
                idsToFetch.map((id) =>
                    getLatestLocation(id)
                        .then((r) => ({ id, data: r?.data?.data ?? r?.data, ok: true }))
                        .catch(() => ({ id, data: null, ok: false }))
                )
            ).then((results) => {
                const locs = results
                    .filter((r) => r.ok && r.data && r.data.latitude != null)
                    .map((r) => ({
                        patientId: r.id,
                        patientName: list.find((p) => p.id === r.id)?.name ?? `Patient ${format3(r.id)}`,
                        latitude: r.data.latitude,
                        longitude: r.data.longitude,
                        timestamp: r.data.timestamp,
                        locationConsent: r.data.locationConsent !== false,
                    }));
                return locs;
            }),
            Promise.all(
                idsToFetch.map((id) =>
                    getSafeZones(id)
                        .then((r) => ({ id, zones: Array.isArray(r?.data) ? r.data : (r?.data?.data ?? []) }))
                        .catch(() => ({ id, zones: [] }))
                )
            ).then((pairs) => {
                return pairs.flatMap((p) =>
                    Array.isArray(p.zones) ? p.zones.map((z) => ({ ...z, patientId: p.id })) : []
                );
            }),
            Promise.all(
                idsToFetch.map((id) =>
                    getLocationAlerts(id)
                        .then((r) => ({ id, alerts: Array.isArray(r?.data) ? r.data : (r?.data?.data ?? []) }))
                        .catch(() => ({ id, alerts: [] }))
                )
            ).then((pairs) => {
                const byPatient = {};
                pairs.forEach(({ id, alerts }) => {
                    byPatient[id] = Array.isArray(alerts) ? alerts : [];
                });
                return byPatient;
            }),
        ])
            .then(([locs, zoneList, byPatient]) => {
                if (cancelled) return;
                setLocations(locs);
                setZones(zoneList);
                setAlertsByPatient(byPatient);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message ?? "Failed to load location data.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [idsToFetch.join(","), patientList.length, refreshKey]);

    // Auto-refresh location every 30 seconds when page is visible
    useEffect(() => {
        if (idsToFetch.length === 0) return;
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, [idsToFetch.length]);

    const hasRecentAlert = (pid) => {
        const list = alertsByPatient[pid] ?? [];
        if (list.length === 0) return false;
        const latest = list[0];
        const t = latest?.timestamp ? new Date(latest.timestamp).getTime() : 0;
        const oneDay = 24 * 60 * 60 * 1000;
        return Date.now() - t < oneDay;
    };

    const liveLocations = useMemo(
        () => locations.filter((loc) => loc.locationConsent !== false),
        [locations]
    );
    const lastSeenLocations = useMemo(
        () => locations.filter((loc) => loc.locationConsent === false),
        [locations]
    );

    const noPatientsWithConsent = idsToFetch.length === 0 && targetIds.length > 0;
    const isEmpty = !loading && liveLocations.length === 0 && zones.length === 0 && idsToFetch.length > 0;
    const hasData = liveLocations.length > 0 || zones.length > 0 || lastSeenLocations.length > 0;
    const showMap = !loading && idsToFetch.length > 0;

    const recentAlertsList = useMemo(() => {
        const list = [];
        idsToFetch.forEach((pid) => {
            (alertsByPatient[pid] ?? []).forEach((a) => {
                const patientName = patientList.find((p) => p.id === pid)?.name ?? `Patient ${format3(pid)}`;
                list.push({
                    ...a,
                    patientId: pid,
                    patientName,
                });
            });
        });
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return list.slice(0, 10);
    }, [idsToFetch, alertsByPatient, patientList]);

    const currentlyOutsideList = useMemo(() => {
        return liveLocations
            .filter((loc) => {
                const patientZones = zones.filter((z) => z.patientId === loc.patientId);
                const hasNoZones = patientZones.length === 0;
                const isInsideAnyZone =
                    !hasNoZones &&
                    patientZones.some((z) => isInsideZone(loc.latitude, loc.longitude, z));
                return hasNoZones || !isInsideAnyZone;
            })
            .map((loc) => ({
                patientId: loc.patientId,
                patientName: loc.patientName,
                timestamp: loc.timestamp,
                isCurrentlyOutside: true,
            }));
    }, [liveLocations, zones]);

    const hasAnyAlertsOrOutside = recentAlertsList.length > 0 || currentlyOutsideList.length > 0;

    /** Format coordinates for "last seen at" display */
    const formatCoords = (lat, lng) =>
        `${Number(lat).toFixed(5)}°, ${Number(lng).toFixed(5)}°`;

    /** Combined list: currently outside (always shown) + history alerts filtered by period, sorted by time desc. */
    const combinedAlertsList = useMemo(() => {
        const outsideItems = currentlyOutsideList.map((loc) => ({
            type: "outside",
            key: `outside-${loc.patientId}`,
            patientId: loc.patientId,
            patientName: loc.patientName,
            timestamp: loc.timestamp,
            message: "Currently outside safe zone",
        }));
        const filteredHistory = filterAlertsByRange(
            recentAlertsList.map((a) => ({ type: "alert", key: String(a.id), ...a })),
            alertFilter
        );
        const items = [...outsideItems, ...filteredHistory];
        items.sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
        });
        return items;
    }, [currentlyOutsideList, recentAlertsList, alertFilter]);

    return (
        <div className="loc-page">
            <div className="loc-header">
                <div>
                    <h1 className="loc-title">Location</h1>
                    <p className="loc-subtitle">View patient locations and safe zones on the map.</p>
                </div>
                <div className="loc-actions">
                    <button
                        type="button"
                        className="loc-btn"
                        onClick={() => {
                            getPatients()
                                .then((res) => {
                                    setPatients(res);
                                    setRefreshKey((k) => k + 1);
                                })
                                .catch(() => setPatients([]));
                        }}
                        disabled={loading}
                    >
                        <RefreshCw size={16} />
                        {loading ? "Loading…" : "Refresh"}
                    </button>
                    {patientList.length > 0 && (
                        <button
                            type="button"
                            className="loc-btn loc-btn-primary"
                            onClick={() => {
                                setAddZoneForPatientId(
                                    patientId !== "all" ? String(patientId) : String(patientList[0]?.id ?? "")
                                );
                                setAddZoneMode(true);
                            }}
                        >
                            <Plus size={16} />
                            Add safe zone
                        </button>
                    )}
                </div>
            </div>

            <div className="loc-panel">

                {patientList.length > 0 && (
                    <div className="loc-alerts-section">
                        <h3 className="loc-alerts-section-title">
                            <AlertTriangle size={18} aria-hidden/> Location alerts
                        </h3>
                        <div className="loc-alert-filter-bar">
                            <span className="loc-alert-filter-label">Alert period:</span>
                            <div className="loc-alert-filters">
                                {LOC_ALERT_FILTERS.map((f) => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        className={`loc-alert-filter-btn ${alertFilter === f.value ? "loc-alert-filter-btn-active" : ""}`}
                                        onClick={() => setAlertFilter(f.value)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="loc-alerts-intro">
                            All events are kept: when they left the zone and when they returned, so you can spot
                            patterns and how long they were out.
                        </p>

                        <div className="loc-control">
                            <label className="loc-label">Patient</label>
                            <select
                                className="loc-select"
                                value={patientId}
                                onChange={(e) => {
                                    setPatientId(e.target.value);
                                    resetAddZone();
                                    setEditingZoneId(null);
                                }}
                            >
                                <option value="all">All patients</option>
                                {patientList.map((p) => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.name ?? "Patient"} (ID {format3(p.id)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {patientList.length > 0 && (
                            <div className="loc-controls">
                            </div>
                        )}

                        {noPatientsWithConsent && (
                            <div className="loc-hint loc-hint-warning">
                                Select a patient who has <strong>location sharing</strong> enabled to see live location and alerts. You can still <strong>add safe zones</strong> for any patient before they turn sharing on; they will apply once location updates are received.
                            </div>
                        )}

                        {error && <div className="loc-error">{error}</div>}

                        {lastSeenLocations.length > 0 && (
                            <div className="loc-last-seen-section">
                                <h3 className="loc-last-seen-title">
                                    <AlertTriangle size={18} className="loc-last-seen-icon" aria-hidden />
                                    Location sharing off
                                </h3>
                                <p className="loc-last-seen-intro">
                                    These patients have turned off location sharing. You cannot see their live location. Last known position:
                                </p>
                                <ul className="loc-last-seen-list">
                                    {lastSeenLocations.map((loc) => {
                                        const atTime = loc.timestamp
                                            ? new Date(loc.timestamp).toLocaleString(undefined, {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })
                                            : "—";
                                        const coords = formatCoords(loc.latitude, loc.longitude);
                                        return (
                                            <li key={loc.patientId} className="loc-last-seen-card">
                                                <span className="loc-last-seen-patient">{loc.patientName}</span>
                                                <span className="loc-last-seen-label">Last seen</span>
                                                <span className="loc-last-seen-datetime">{atTime}</span>
                                                <span className="loc-last-seen-location">
                                                    {coords}
                                                    <a
                                                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="loc-last-seen-map-link"
                                                    >
                                                        View on map
                                                    </a>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {noPatientsWithConsent ? (
                            <p className="loc-alerts-empty">Select a patient with location sharing enabled to see
                                location alerts.</p>
                        ) : combinedAlertsList.length === 0 ? (
                            <p className="loc-alerts-empty">No alerts in this period. Try &quot;This
                                week&quot; or &quot;This month&quot; for more history.</p>
                        ) : (
                            <ul className="loc-alert-list">
                                {combinedAlertsList.map((item) => {
                                    const returned = item.type === "alert" && isReturnAlert(item);
                                    const atTime = item.timestamp
                                        ? new Date(item.timestamp).toLocaleString(undefined, {
                                            dateStyle: "short",
                                            timeStyle: "short"
                                        })
                                        : "—";
                                    const durationMs =
                                        item.type === "alert" && returned
                                            ? getDurationOutsideMs(recentAlertsList, item)
                                            : null;
                                    const durationStr = durationMs != null ? formatDurationOutside(durationMs) : null;
                                    return (
                                        <li
                                            key={item.key}
                                            className={`loc-alert-card ${returned ? "loc-alert-card-returned" : ""}`}
                                        >
                                            {returned ? (
                                                <CheckCircle2 size={16}
                                                              className="loc-alert-card-icon loc-alert-card-icon-returned"
                                                              aria-hidden/>
                                            ) : (
                                                <AlertTriangle size={16} className="loc-alert-card-icon" aria-hidden/>
                                            )}
                                            <div className="loc-alert-card-content">
                                                <span className="loc-alert-card-patient">{item.patientName}</span>
                                                <span
                                                    className="loc-alert-card-message">{item.message ?? "Left safe zone"}</span>
                                                <span className="loc-alert-card-time">
                                                {item.type === "outside"
                                                    ? atTime !== "—"
                                                        ? `Last update: ${atTime}`
                                                        : "—"
                                                    : returned
                                                        ? `Returned at ${atTime}`
                                                        : `Left at ${atTime}`}
                                            </span>
                                                {item.type === "alert" && returned && durationStr && (
                                                    <span
                                                        className="loc-alert-card-duration">Was out for {durationStr}</span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                <div className="loc-map-wrap">
                    {loading && (
                        <div className="loc-loading">
                            <RefreshCw size={24} className="loc-spin"/>
                            <span>Loading map data…</span>
                        </div>
                    )}
                    {!loading && targetIds.length === 0 && (
                        <div className="loc-empty">
                            <MapPin size={48}/>
                            <p>Select a patient above to view location and safe zones.</p>
                        </div>
                    )}
                    {!loading && targetIds.length > 0 && noPatientsWithConsent && (
                        <div className="loc-empty">
                            <MapPin size={48}/>
                            <p>No patient with location sharing selected.</p>
                            <p className="loc-empty-hint">Choose a patient who has location sharing enabled. Patients enable this in their app; you can see their status in patient details.</p>
                        </div>
                    )}
                    {showMap && (
                        <MapContainer
                            center={DEFAULT_CENTER}
                            zoom={DEFAULT_ZOOM}
                            className="loc-map"
                            scrollWheelZoom
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapClickHandler
                                onMapClick={handleMapClickForZone}
                                enabled={addZoneMode && effectiveZonePatientId != null}
                            />
                            <MapFitBounds locations={liveLocations} zones={zones} />
                            {draftZoneCenter && (
                                <Circle
                                    center={draftZoneCenter}
                                    radius={
                                        safeZoneForm.radius === CUSTOM_RADIUS
                                            ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(safeZoneForm.customRadius) || MIN_RADIUS))
                                            : (safeZoneForm.radius || 200)
                                    }
                                    pathOptions={{
                                        color: "#16a34a",
                                        fillColor: "#22c55e",
                                        fillOpacity: 0.25,
                                        weight: 2,
                                        dashArray: "6 4",
                                    }}
                                />
                            )}
                            {draftZoneCenter && (
                                <Marker position={draftZoneCenter} icon={createMarkerIcon("#16a34a")}>
                                    <Popup>New safe zone centre (adjust name and size below, then Save)</Popup>
                                </Marker>
                            )}
                            {zones.map((z) => (
                                <Circle
                                    key={z.id}
                                    center={[z.centerLat, z.centerLng]}
                                    radius={z.radius}
                                    pathOptions={{
                                        color: "#2563eb",
                                        fillColor: "#3b82f6",
                                        fillOpacity: 0.2,
                                        weight: 2,
                                    }}
                                    eventHandlers={{
                                        click: () => {},
                                    }}
                                >
                                    <Popup>
                                        <strong>{z.name}</strong>
                                        <br />
                                        Radius: {z.radius} m
                                    </Popup>
                                </Circle>
                            ))}
                            {liveLocations.map((loc) => {
                                const patientZones = zones.filter((z) => z.patientId === loc.patientId);
                                const hasNoZones = patientZones.length === 0;
                                const isInsideAnyZone =
                                    !hasNoZones &&
                                    patientZones.some((z) => isInsideZone(loc.latitude, loc.longitude, z));
                                const outside = hasNoZones || !isInsideAnyZone;
                                return (
                                    <Marker
                                        key={loc.patientId}
                                        position={[loc.latitude, loc.longitude]}
                                        icon={outside ? iconOutside : iconInside}
                                    >
                                        <Popup>
                                            <strong>{loc.patientName}</strong>
                                            <br />
                                            ID {format3(loc.patientId)}
                                            {loc.timestamp && (
                                                <>
                                                    <br />
                                                    <small>
                                                        {new Date(loc.timestamp).toLocaleString()}
                                                    </small>
                                                </>
                                            )}
                                            {outside && (
                                                <>
                                                    <br />
                                                    <span className="loc-popup-alert">
                                                        <AlertTriangle size={14} />
                                                        {hasNoZones ? "No safe zone set" : "Outside safe zone"}
                                                    </span>
                                                </>
                                            )}
                                            <br />
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="loc-popup-nav-btn"
                                            >
                                                <Navigation size={14} />
                                                Go to location
                                            </a>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}

                    {showMap && isEmpty && patientList.length > 0 && (
                        <div className="loc-map-hint">
                            No location or safe zones yet. Click &quot;Add safe zone&quot; above, then click on the map where the centre should be (e.g. home), or search for a place.
                        </div>
                    )}
                </div>

                {addZoneMode && effectiveZonePatientId != null && (
                    <div ref={addZonePanelRef} className="loc-add-zone loc-modal-style loc-add-zone-visible">
                        <div className="loc-modal-header">
                            <div>
                                <div className="loc-modal-title">Add safe zone</div>
                                <div className="loc-modal-subtitle">
                                    Set the centre on the map or search for a place, then give it a name and size.
                                </div>
                            </div>
                            <button type="button" className="loc-modal-close" onClick={resetAddZone} aria-label="Close">
                                ×
                            </button>
                        </div>
                        <div className="loc-modal-body">
                        {patientId === "all" && (
                            <div className="loc-field" style={{ marginBottom: 16 }}>
                                <label className="loc-label" htmlFor="loc-add-zone-patient">
                                    Patient
                                </label>
                                <select
                                    id="loc-add-zone-patient"
                                    className="loc-select"
                                    value={addZoneForPatientId}
                                    onChange={(e) => {
                                        setAddZoneForPatientId(e.target.value);
                                        setDraftZoneCenter(null);
                                        setSearchResult(null);
                                    }}
                                >
                                    {patientList.map((p) => (
                                        <option key={p.id} value={String(p.id)}>
                                            {p.name ?? "Patient"} (ID {format3(p.id)})
                                        </option>
                                    ))}
                                </select>
                                <p className="loc-add-zone-hint" style={{ marginTop: 8 }}>
                                    Choose who this zone is for. You can add zones before they enable location sharing in the app.
                                </p>
                            </div>
                        )}
                        {!draftZoneCenter ? (
                            <>
                                <p className="loc-add-zone-step">Step 1: Set the centre of the safe zone</p>
                                <p className="loc-add-zone-hint">Click on the map where the centre should be (e.g. home or day centre), or search for a place below.</p>
                                <div className="loc-search-row">
                                    <input
                                        type="text"
                                        className="loc-input"
                                        placeholder="Search for a place (e.g. address or place name)"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearchPlace()}
                                    />
                                    <button type="button" className="loc-btn" onClick={handleSearchPlace} disabled={searchLoading || !searchQuery.trim()}>
                                        <Search size={16} />
                                        {searchLoading ? "Searching…" : "Search"}
                                    </button>
                                </div>
                                {searchResult && (
                                    <div className="loc-search-result">
                                        <p className="loc-search-result-label">Use this as centre:</p>
                                        <p className="loc-search-result-name">{searchResult.display_name}</p>
                                        <button type="button" className="loc-btn loc-btn-primary" onClick={applySearchResultAsCenter}>
                                            Use this location
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="loc-add-zone-step">Step 2: Name and size</p>
                                <div className="loc-add-zone-form">
                                    <div className="loc-field">
                                        <label className="loc-label">Name (e.g. Home, Day centre)</label>
                                        <input
                                            type="text"
                                            className="loc-input"
                                            value={safeZoneForm.name}
                                            onChange={(e) => setSafeZoneForm((f) => ({ ...f, name: e.target.value }))}
                                            placeholder="Home"
                                        />
                                    </div>
                                    <div className="loc-field">
                                        <label className="loc-label">Size of the zone</label>
                                        <select
                                            className="loc-select"
                                            value={String(safeZoneForm.radius)}
                                            onChange={(e) =>
                                                setSafeZoneForm((f) => ({
                                                    ...f,
                                                    radius: e.target.value === CUSTOM_RADIUS ? CUSTOM_RADIUS : parseInt(e.target.value, 10),
                                                }))
                                            }
                                        >
                                            {RADIUS_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {safeZoneForm.radius === CUSTOM_RADIUS && (
                                        <div className="loc-field">
                                            <label className="loc-label">Distance (metres)</label>
                                            <input
                                                type="number"
                                                className="loc-input"
                                                min={MIN_RADIUS}
                                                max={MAX_RADIUS}
                                                value={safeZoneForm.customRadius}
                                                onChange={(e) => {
                                                    const v = parseInt(e.target.value, 10);
                                                    setSafeZoneForm((f) => ({ ...f, customRadius: Number.isNaN(v) ? MIN_RADIUS : v }));
                                                }}
                                                placeholder={`${MIN_RADIUS}–${MAX_RADIUS}`}
                                            />
                                            <span className="loc-field-hint">{MIN_RADIUS}–{MAX_RADIUS} m</span>
                                        </div>
                                    )}
                                    <div className="loc-add-zone-actions">
                                        <button type="button" className="loc-btn" onClick={() => setDraftZoneCenter(null)}>
                                            Change location on map
                                        </button>
                                        <button type="button" className="loc-btn loc-btn-primary" onClick={handleSaveNewZone} disabled={zoneSaving}>
                                            {zoneSaving ? "Saving…" : "Save safe zone"}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        </div>
                    </div>
                )}

                {hasSinglePatientSelected && zonesForSelectedPatient.length > 0 && (
                    <div className="loc-zones-list">
                        <h3 className="loc-zones-list-title">Safe zones for this patient</h3>
                        <ul className="loc-zones-ul">
                            {zonesForSelectedPatient.map((z) => (
                                <li key={z.id} className="loc-zone-item">
                                    {editingZoneId === z.id ? (
                                        <div className="loc-zone-edit">
                                            <input
                                                type="text"
                                                className="loc-input loc-input-sm"
                                                value={editZoneForm.name}
                                                onChange={(e) => setEditZoneForm((f) => ({ ...f, name: e.target.value }))}
                                                placeholder="Name"
                                            />
                                            <select
                                                className="loc-select loc-select-sm"
                                                value={String(editZoneForm.radius)}
                                                onChange={(e) =>
                                                    setEditZoneForm((f) => ({
                                                        ...f,
                                                        radius: e.target.value === CUSTOM_RADIUS ? CUSTOM_RADIUS : parseInt(e.target.value, 10),
                                                    }))
                                                }
                                            >
                                                {RADIUS_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {editZoneForm.radius === CUSTOM_RADIUS && (
                                                <input
                                                    type="number"
                                                    className="loc-input loc-input-sm"
                                                    min={MIN_RADIUS}
                                                    max={MAX_RADIUS}
                                                    value={editZoneForm.customRadius ?? MIN_RADIUS}
                                                    onChange={(e) => {
                                                        const v = parseInt(e.target.value, 10);
                                                        setEditZoneForm((f) => ({ ...f, customRadius: Number.isNaN(v) ? MIN_RADIUS : v }));
                                                    }}
                                                    placeholder={`${MIN_RADIUS}–${MAX_RADIUS}`}
                                                />
                                            )}
                                            <button type="button" className="loc-btn loc-btn-sm" onClick={handleUpdateZone} disabled={zoneSaving}>
                                                Save
                                            </button>
                                            <button type="button" className="loc-btn loc-btn-sm" onClick={() => setEditingZoneId(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="loc-zone-name">{z.name}</span>
                                            <span className="loc-zone-size">
                                                {[10, 100, 200, 500].includes(z.radius) ? RADIUS_OPTIONS.find((o) => o.value === z.radius)?.label : `${z.radius} m`}
                                            </span>
                                            <div className="loc-zone-actions">
                                                <button
                                                    type="button"
                                                    className="loc-btn-icon"
                                                    onClick={() => {
                                                        setEditingZoneId(z.id);
                                                        setEditZoneForm({
                                                            name: z.name,
                                                            radius: [10, 100, 200, 500].includes(z.radius) ? z.radius : CUSTOM_RADIUS,
                                                            customRadius: z.radius,
                                                        });
                                                    }}
                                                    aria-label="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="loc-btn-icon loc-btn-icon-danger"
                                                    onClick={() => handleDeleteZone(z.id)}
                                                    disabled={deletingZoneId === z.id}
                                                    aria-label="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {hasData && (
                    <div className="loc-legend">
                        <span className="loc-legend-item">
                            <span className="loc-legend-marker loc-legend-inside" /> In safe zone
                        </span>
                        <span className="loc-legend-item">
                            <span className="loc-legend-marker loc-legend-outside" /> Outside safe zone
                        </span>
                        <span className="loc-legend-item">
                            <span className="loc-legend-circle" /> Safe zone (radius)
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
