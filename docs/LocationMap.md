# Location Map – Technical Documentation

## Overview

The caregiver dashboard includes a **Location** page where caregivers can view patient locations and define **safe zones** (geofences) on a map. This document describes how the map is implemented and why this approach was chosen.

**For user-facing instructions** (how patients and caregivers use location sharing), see [GeolocationSharing.md](GeolocationSharing.md).

---

## Map Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Map library** | [Leaflet](https://leafletjs.com/) via [react-leaflet](https://react-leaflet.js.org/) | Interactive map (pan, zoom, markers, circles, popups, click handling) |
| **Map tiles** | [OpenStreetMap](https://www.openstreetmap.org/) | Map imagery (streets, labels, terrain) |
| **Geocoding** | [Nominatim](https://nominatim.org/) (OpenStreetMap) | Address / place search (“Search for a place” on Location page) |
| **Distance / geofencing** | Haversine formula (in-app) | Check if a point is inside a safe zone; no third-party geofencing API |
| **Navigation link** | Google Maps (URL only) | Turn-by-turn directions when caregiver taps "Go to location" |

---

## Why OpenStreetMap for the map? Why Google Maps for navigation?

We use **two different services for two different tasks**:

### Map display: OpenStreetMap

The main map (tiles, markers, safe zones) uses OpenStreetMap, not Google Maps, because:

- **No API key or costs** — OpenStreetMap tiles and Nominatim geocoding are free. No sign-up, no usage limits, no per-request fees. The dashboard can stay open for hours without incurring map costs.
- **Google Maps would require** an API key, billing account, and has usage limits. Beyond the free tier, map loads and geocoding are charged. For a dashboard that may be open often, this can add up.
- **Display only** — We need to show patient positions and safe zones. Leaflet + OpenStreetMap provide tiles, markers, and circles. We do not need turn-by-turn routing for this; OSM is sufficient.

### Navigation link: Google Maps

The **"Go to location"** button opens Google Maps (not OpenStreetMap) because:

- **Turn-by-turn navigation** — When a caregiver needs to drive to the patient, they need voice-guided, turn-by-turn directions. Google Maps excels at this and is widely installed on phones. A simple URL (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`) opens Google Maps and lets the user start navigation with one tap.
- **OpenStreetMap.org** can show directions in the browser, but it does not open a native navigation app or provide the same level of turn-by-turn polish. Apps like OsmAnd use OSM data but require the user to have them installed.
- **No API key for the link** — We are not embedding the Google Maps API. We only open a URL. That does not require a key or billing.


---

## Why This Approach?

- **No commercial map API for display**  
  Leaflet + OpenStreetMap + Nominatim are free and do not require API keys for our usage, which keeps the project simple and free of per-request map costs. (See above for why we use Google Maps only for the navigation link.)

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
   Latest location per patient comes from our backend (`GET /api/location/latest?patientId=...`). The patient app sends updates via `POST /api/location/patient/update`. When offline, the patient app queues updates locally and sends them when back online. Coordinates are shown as markers (green = inside a zone, red = outside or no zone).

3. **Safe zones**  
   Zones are stored in our database (centre + radius). The frontend draws them as Leaflet `Circle` components. Caregivers add or edit zones by clicking the map or searching for a place (Nominatim); they do not enter raw coordinates.

4. **Place search**  
   “Search for a place” calls Nominatim: `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`. Results are used to set the centre of a new or edited safe zone. A `User-Agent` header (e.g. `NeuroEaseCaregiver/1.0`) is sent to comply with Nominatim’s usage policy.

5. **Inside/outside**  
   For each patient location we compute distance to each safe zone centre (Haversine). If distance ≤ zone radius, the point is inside that zone. The marker colour and any “outside safe zone” messaging use this result.

6. **Go to location (Google Maps link)**  
   Clicking a patient marker opens a popup with a **"Go to location"** button. This opens Google Maps in a new tab with the patient's coordinates as the destination: `https://www.google.com/maps/dir/?api=1&destination=lat,lng`. On mobile, the user can start turn-by-turn navigation; on desktop, Google Maps shows directions with the caregiver's current location as the origin (when available). We use Google Maps only for this navigation link—the map display remains OpenStreetMap.

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
