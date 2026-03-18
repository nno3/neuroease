# 24/7 Background Location Tracking (Developer Setup)

**For end users:** See [GeolocationSharing.md](GeolocationSharing.md) for how patients and caregivers use location sharing.

---

This guide explains how to enable **24/7 location tracking** for the NeuroEase patient app, so caregivers can see the patient's location even when the app is closed or in the background.

## Overview

- **Web/PWA (browser)**: Location is only sent while the app is open. This is a browser limitation.
- **Native app (Capacitor)**: Location is sent 24/7, including when the app is closed or screen is locked.

To get 24/7 tracking, the patient app must be built as a **native iOS/Android app** using Capacitor, with the background geolocation plugin.

## Requirements

You will need:

- **Xcode** (Mac only) for iOS builds
- **Android Studio** for Android builds
- **Node.js** 18+
- **Apple Developer account** (for iOS distribution)
- **Google Play Developer account** (for Android distribution, optional for testing)

## Setup Steps

### 1. Install Capacitor and plugins

From the `patient-app` directory, install the required packages:

```bash
cd patient-app
npm install @capacitor/core @capacitor/cli @capacitor-community/background-geolocation @capacitor/ios @capacitor/android
```

If Capacitor is not yet set up, run:

```bash
npx cap init "NeuroEase" "com.neuroease.patient" --web-dir dist
npx cap add ios
npx cap add android
```

If the project already has Capacitor, run `npx cap add ios` and `npx cap add android` to add the native platforms if they are missing.

Ensure `capacitor.config.json` (or `capacitor.config.ts`) includes:

- `webDir: 'dist'` (Vite's output directory)
- `CapacitorHttp.enabled: true` (required for Android background HTTP)
- `android.useLegacyBridge: true` (required for background location on Android)

### 2. iOS configuration

Edit `ios/App/App/Info.plist` and add:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>NeuroEase shares your location with your caregiver so they can see where you are and get alerts if you leave a safe zone.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>NeuroEase needs to share your location 24/7 with your caregiver, even when the app is closed, so they can help keep you safe.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

### 3. Android configuration

Edit `capacitor.config.json` (or `capacitor.config.ts`) to set:

```json
{
  "android": {
    "useLegacyBridge": true
  }
}
```

On Android 13+, the app will request notification permission (for the background tracking notification). This is handled by the plugin.

### 4. Set the API base URL

For the native app to reach the backend, set `VITE_API_BASE` when building:

```bash
VITE_API_BASE=https://your-backend.example.com npm run build
```

Use the production backend URL. For local testing, use the machine's IP address (e.g. `http://192.168.1.100:5001`). The iPhone and Mac must be on the same Wi‑Fi network for local testing.

### 5. Build and run

```bash
npm run build
npx cap sync
npx cap open ios    # Opens Xcode – build and run on device
npx cap open android # Opens Android Studio – build and run on device
```

**Important**: Background location must be tested on a **real device**, not the simulator.

## How it works

1. The patient enables location sharing in Profile.
2. When running as a native app, the background geolocation plugin sends location updates every 30 seconds (or when the device moves 50m), even when:
   - The app is closed
   - The screen is locked
   - Another app is in the foreground
3. The caregiver dashboard shows the location in real time and auto-refreshes every 30 seconds.
4. **Offline queue**: If the device is offline or the API request fails, location updates are queued in `localStorage` (key: `neuroease_location_queue`, max 100 items). When the connection is restored, the app flushes the queue automatically. This applies to both web and native builds.

## User experience

- **iOS**: The patient must choose "Always" when prompted for location permission.
- **Android**: A persistent notification shows "NeuroEase is sharing your location" while tracking is on. This is required by Android and cannot be hidden.
- **Battery**: Background location uses more battery. The plugin is optimized with `distanceFilter: 50` (only sends when moving 50m) to reduce updates.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Location stops after 5 min on Android | Ensure `android.useLegacyBridge: true` in Capacitor config. |
| "Always" not offered on iOS | Check Info.plist has `NSLocationAlwaysAndWhenInUseUsageDescription`. |
| No location when app closed | Verify the **native build** is running (from Xcode/Android Studio), not the PWA in a browser. |
| API requests fail in background (Android) | CapacitorHttp is bundled with `@capacitor/core`. Ensure it is enabled in the Capacitor config. |

## Distribution

- **iOS**: Archive in Xcode → Distribute via TestFlight or App Store.
- **Android**: Build release APK/AAB in Android Studio → Upload to Play Store or distribute directly.

For internal or caregiver use, the APK can be installed directly on Android devices without the Play Store.
