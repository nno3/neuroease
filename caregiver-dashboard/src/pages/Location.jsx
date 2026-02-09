import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw, AlertTriangle, Plus, Search, Pencil, Trash2, X } from "lucide-react";
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
const MIN_RADIUS = 50;
const MAX_RADIUS = 5000;

const RADIUS_OPTIONS = [
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
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all");
    const [locations, setLocations] = useState([]);
    const [zones, setZones] = useState([]);
    const [alertsByPatient, setAlertsByPatient] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const [addZoneMode, setAddZoneMode] = useState(false);
    const [draftZoneCenter, setDraftZoneCenter] = useState(null);
    const [safeZoneForm, setSafeZoneForm] = useState({ name: "Home", radius: 200, customRadius: 200 });
    const [zoneSaving, setZoneSaving] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null);
    const [editZoneForm, setEditZoneForm] = useState({ name: "", radius: 200 });
    const [deletingZoneId, setDeletingZoneId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);

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

    const idsWithLocationConsent = useMemo(() => {
        return new Set(
            patientList
                .filter((p) => Boolean((p.Patient ?? p.profile)?.locationConsent))
                .map((p) => p.id)
        );
    }, [patientList]);

    const idsToFetch = useMemo(
        () => targetIds.filter((id) => idsWithLocationConsent.has(id)),
        [targetIds, idsWithLocationConsent]
    );

    const singlePatientId = patientId !== "all" ? parseInt(patientId, 10) : null;
    const canManageZones = singlePatientId != null && !Number.isNaN(singlePatientId) && idsWithLocationConsent.has(singlePatientId);

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
        setDraftZoneCenter(null);
        setSafeZoneForm({ name: "Home", radius: 200, customRadius: 200 });
        setSearchQuery("");
        setSearchResult(null);
    }, []);

    const handleSaveNewZone = useCallback(() => {
        if (!draftZoneCenter || !canManageZones) return;
        const [centerLat, centerLng] = draftZoneCenter;
        const name = (safeZoneForm.name || "Home").trim();
        const radius =
            safeZoneForm.radius === CUSTOM_RADIUS
                ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(safeZoneForm.customRadius) || MIN_RADIUS))
                : (safeZoneForm.radius || 200);
        setZoneSaving(true);
        setError("");
        createSafeZone(singlePatientId, { name, centerLat, centerLng, radius })
            .then(() => {
                setRefreshKey((k) => k + 1);
                resetAddZone();
            })
            .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to add safe zone"))
            .finally(() => setZoneSaving(false));
    }, [draftZoneCenter, canManageZones, safeZoneForm, singlePatientId, resetAddZone]);

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
        if (addZoneMode && canManageZones && addZonePanelRef.current) {
            addZonePanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [addZoneMode, canManageZones]);

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

    const hasRecentAlert = (pid) => {
        const list = alertsByPatient[pid] ?? [];
        if (list.length === 0) return false;
        const latest = list[0];
        const t = latest?.timestamp ? new Date(latest.timestamp).getTime() : 0;
        const oneDay = 24 * 60 * 60 * 1000;
        return Date.now() - t < oneDay;
    };

    const noPatientsWithConsent = idsToFetch.length === 0 && targetIds.length > 0;
    const isEmpty = !loading && locations.length === 0 && zones.length === 0 && idsToFetch.length > 0;
    const hasData = locations.length > 0 || zones.length > 0;
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
        return locations
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
    }, [locations, zones]);

    const hasAnyAlertsOrOutside = recentAlertsList.length > 0 || currentlyOutsideList.length > 0;

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
                    {canManageZones && (
                        <button
                            type="button"
                            className="loc-btn loc-btn-primary"
                            onClick={() => setAddZoneMode(true)}
                        >
                            <Plus size={16} />
                            Add safe zone
                        </button>
                    )}
                </div>
            </div>

            <div className="loc-panel">
                <div className="loc-controls">
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
                </div>

                {noPatientsWithConsent && (
                    <div className="loc-hint loc-hint-warning">
                        Select a patient who has <strong>location sharing</strong> enabled to view or add safe zones. Patients enable this in their app; you can see their status in patient details.
                    </div>
                )}

                {error && <div className="loc-error">{error}</div>}

                {hasAnyAlertsOrOutside && (
                    <div className="loc-alerts-banner">
                        <AlertTriangle size={20} className="loc-alerts-banner-icon" aria-hidden />
                        <div className="loc-alerts-banner-content">
                            <strong className="loc-alerts-banner-title">Location alerts &amp; status</strong>
                            <ul className="loc-alerts-list">
                                {currentlyOutsideList.map((loc) => (
                                    <li key={`outside-${loc.patientId}`} className="loc-alert-item">
                                        <span className="loc-alert-patient">{loc.patientName}</span>
                                        <span className="loc-alert-message">Currently outside safe zone</span>
                                        <span className="loc-alert-time">
                                            {loc.timestamp
                                                ? new Date(loc.timestamp).toLocaleString(undefined, {
                                                    dateStyle: "short",
                                                    timeStyle: "short",
                                                })
                                                : ""}
                                        </span>
                                    </li>
                                ))}
                                {recentAlertsList.map((a) => (
                                    <li key={a.id} className="loc-alert-item">
                                        <span className="loc-alert-patient">{a.patientName}</span>
                                        <span className="loc-alert-message">{a.message ?? "Left safe zone"}</span>
                                        <span className="loc-alert-time">
                                            {a.timestamp
                                                ? new Date(a.timestamp).toLocaleString(undefined, {
                                                    dateStyle: "short",
                                                    timeStyle: "short",
                                                })
                                                : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="loc-map-wrap">
                    {loading && (
                        <div className="loc-loading">
                            <RefreshCw size={24} className="loc-spin" />
                            <span>Loading map data…</span>
                        </div>
                    )}
                    {!loading && targetIds.length === 0 && (
                        <div className="loc-empty">
                            <MapPin size={48} />
                            <p>Select a patient above to view location and safe zones.</p>
                        </div>
                    )}
                    {!loading && targetIds.length > 0 && noPatientsWithConsent && (
                        <div className="loc-empty">
                            <MapPin size={48} />
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
                                enabled={addZoneMode && canManageZones}
                            />
                            <MapFitBounds locations={locations} zones={zones} />
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
                            {locations.map((loc) => {
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
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}

                    {showMap && isEmpty && canManageZones && (
                        <div className="loc-map-hint">
                            No location or safe zones yet. Click &quot;Add safe zone&quot; above, then click on the map where the centre should be (e.g. home), or search for a place.
                        </div>
                    )}
                </div>

                {addZoneMode && canManageZones && (
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

                {canManageZones && zonesForSelectedPatient.length > 0 && (
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
                                                {[100, 200, 500].includes(z.radius) ? RADIUS_OPTIONS.find((o) => o.value === z.radius)?.label : `${z.radius} m`}
                                            </span>
                                            <div className="loc-zone-actions">
                                                <button
                                                    type="button"
                                                    className="loc-btn-icon"
                                                    onClick={() => {
                                                        setEditingZoneId(z.id);
                                                        setEditZoneForm({
                                                            name: z.name,
                                                            radius: [100, 200, 500].includes(z.radius) ? z.radius : CUSTOM_RADIUS,
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
