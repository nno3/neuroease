import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { getPatients } from "../services/patients";
import { getLatestLocation, getSafeZones, getLocationAlerts } from "../services/locationService";
import { format3 } from "../utils/patientHelpers";
import "./Location.css";

const DEFAULT_CENTER = [52.52, 13.405];
const DEFAULT_ZOOM = 10;

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

export default function Location() {
    const [patients, setPatients] = useState([]);
    const [patientId, setPatientId] = useState("all");
    const [locations, setLocations] = useState([]);
    const [zones, setZones] = useState([]);
    const [alertsByPatient, setAlertsByPatient] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

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

    useEffect(() => {
        getPatients()
            .then((res) => setPatients(res))
            .catch(() => setPatients([]));
    }, []);

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

    const isEmpty = !loading && locations.length === 0 && zones.length === 0 && targetIds.length > 0;
    const hasData = locations.length > 0 || zones.length > 0;

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
                </div>
            </div>

            <div className="loc-panel">
                <div className="loc-controls">
                    <div className="loc-control">
                        <label className="loc-label">Patient</label>
                        <select
                            className="loc-select"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
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

                {error && <div className="loc-error">{error}</div>}

                <div className="loc-map-wrap">
                    {loading && (
                        <div className="loc-loading">
                            <RefreshCw size={24} className="loc-spin" />
                            <span>Loading map data…</span>
                        </div>
                    )}
                    {!loading && isEmpty && (
                        <div className="loc-empty">
                            <MapPin size={48} />
                            <p>No location data or safe zones for the selected patient(s).</p>
                            <p className="loc-empty-hint">Location updates and safe zones will appear here.</p>
                        </div>
                    )}
                    {!loading && hasData && (
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
                            <MapFitBounds locations={locations} zones={zones} />
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
                                const outside = hasRecentAlert(loc.patientId);
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
                                                        <AlertTriangle size={14} /> Outside safe zone
                                                    </span>
                                                </>
                                            )}
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}
                </div>

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
