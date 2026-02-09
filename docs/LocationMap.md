# Location Map – Technical Documentation

## Overview

The caregiver dashboard includes a **Location** page where caregivers can view patient locations and define **safe zones** (geofences) on a map. This document describes how the map is implemented and why this approach was chosen.

---

## Map Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Map library** | [Leaflet](https://leafletjs.com/) via [react-leaflet](https://react-leaflet.js.org/) | Interactive map (pan, zoom, markers, circles, popups, click handling) |
| **Map tiles** | [OpenStreetMap](https://www.openstreetmap.org/) | Map imagery (streets, labels, terrain) |
| **Geocoding** | [Nominatim](https://nominatim.org/) (OpenStreetMap) | Address / place search (“Search for a place” on Location page) |
| **Distance / geofencing** | Haversine formula (in-app) | Check if a point is inside a safe zone; no third-party geofencing API |

---

## Why This Approach?

- **No commercial map API**  
  We did not use Google Maps or other paid providers. Leaflet + OpenStreetMap + Nominatim are free and do not require API keys for our usage, which keeps the project simple and free of per-request map costs.

- **Suitable for the use case**  
  Leaflet supports circles (safe zones), markers (patient locations), and map-click handling (e.g. “click to set zone centre”). react-leaflet integrates this cleanly with React, so the Location page can manage state (selected patient, draft zone, zones list) and the map in one place.

- **Familiar, reusable stack**  
  This same stack (Leaflet, OpenStreetMap, Nominatim) has been used in other projects. Reusing it here allowed consistent behaviour and faster implementation.

- **Control over geofencing logic**  
  “Inside/outside safe zone” is determined with a Haversine distance calculation in both backend and frontend. We do not depend on a third-party geofencing API; logic is explicit and consistent everywhere.

---

## How It Works

1. **Rendering the map**  
   The Location page uses `MapContainer`, `TileLayer`, `Circle`, and `Marker` from react-leaflet. Tiles are loaded from `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (OpenStreetMap).

2. **Patient locations**  
   Latest location per patient comes from our backend (`GET /api/location/latest?patientId=...`). Coordinates are shown as markers (green = inside a zone, red = outside or no zone).

3. **Safe zones**  
   Zones are stored in our database (centre + radius). The frontend draws them as Leaflet `Circle` components. Caregivers add or edit zones by clicking the map or searching for a place (Nominatim); they do not enter raw coordinates.

4. **Place search**  
   “Search for a place” calls Nominatim: `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`. Results are used to set the centre of a new or edited safe zone. A `User-Agent` header (e.g. `NeuroEaseCaregiver/1.0`) is sent to comply with Nominatim’s usage policy.

5. **Inside/outside**  
   For each patient location we compute distance to each safe zone centre (Haversine). If distance ≤ zone radius, the point is inside that zone. The marker colour and any “outside safe zone” messaging use this result.

---

## Dependencies

- **Frontend:** `leaflet`, `react-leaflet` (see `caregiver-dashboard/package.json`).
- **Map tiles:** OpenStreetMap (no key; standard tile URL).
- **Geocoding:** Nominatim (no key; optional `User-Agent`).

---

## References

- [Leaflet](https://leafletjs.com/)
- [react-leaflet](https://react-leaflet.js.org/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
