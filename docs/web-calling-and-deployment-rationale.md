# Design rationale: web-based voice and video calling

This note documents the **design objectives** and **technical rationale** behind real-time calling in NeuroEase (caregiver dashboard and patient-facing web application). It is intended to support **methodology** and **system design** sections, why certain approaches were adopted and what trade-offs they entail.

---

## 1. Objectives and constraints

The implementation aims to support **audio and video communication** between caregivers and patients using **web browsers**, without requiring distribution through native application stores at the outset. Operational requirements include:

- **Heterogeneous network conditions** (e.g. domestic Wi‑Fi, cellular data, institutional networks)
- **Acceptable behaviour on mobile browsers**, including Safari and Chromium-based engines
- **Awareness of incoming calls** when the client is not in the foreground
- **Transparent failure modes**: permissions, connectivity, and signalling errors should be communicable to non-specialist users rather than failing silently

A further constraint is to **minimise dependence on proprietary communications platforms as a hard requirement**, while accepting that **standards-based relay infrastructure** (TURN) is typically necessary for reliable connectivity across many real-world NAT and firewall configurations.

---

## 2. Choice of WebRTC with application-managed signalling

The system uses **native browser WebRTC** (`RTCPeerConnection`) rather than a closed third-party real-time communications SDK. Signalling—exchange of session descriptions and ICE candidates—is carried over **Socket.IO** on the existing **authenticated Node.js** backend.

**Rationale**

- **Transparency:** The signalling path, security boundary, and media topology remain **explicit** in the implementation, which supports reproducible description in academic writing and avoids undisclosed vendor behaviour.
- **Alignment with existing architecture:** Reusing **JWT-authenticated** channels avoids introducing a separate identity or authorisation domain solely for calls.
- **Trade-off:** Engineering effort is higher than with a turnkey SDK; edge cases around ICE, mobile media policies, and session recovery must be handled in-house.

---

## 3. Signalling and server role

Signalling events (e.g. offer, answer, ICE candidates, teardown) are **relayed** between peers via server-side rooms keyed by user identifier. The server **does not** parse SDP for the minimum viable product; its role is **timely, authenticated transport** of signalling payloads.

**Rationale**

- Bi-directional, low-latency channels are appropriate for **trickle ICE**.
- Unified authentication with the REST API **reduces the risk** of unauthenticated call initiation.
- Limiting server interpretation of session content **simplifies** the initial compliance and privacy narrative around call metadata versus media paths (media does not transit the application server for relaying in the typical direct case).

---

## 4. NAT traversal and TURN configuration

Connectivity on a single LAN often succeeds with host or STUN-reflexive candidates. Across **disparate networks**—particularly with **carrier-grade NAT**, **symmetric NAT**, or restrictive firewalls—direct peer paths are frequently **unavailable**. **TURN relay** is therefore supported via **configurable `iceServers`**, supplied at build time (e.g. `VITE_ICE_SERVERS` with JSON from a TURN provider).

**Rationale**

- Makes explicit in documentation and evaluation **why** same-network tests may succeed while cross-network tests fail until relay is correctly provisioned.
- For the current deployment scale, **build-time credentials** are a pragmatic choice; **short-lived, server-minted credentials** are the stronger production pattern and may be noted as future hardening.

---

## 5. Connection reliability measures

Several implementation patterns address common WebRTC failure modes:

| Issue | Response |
|--------|-----------|
| ICE candidates arriving before `remoteDescription` is set | Candidates are **queued** and **flushed** after the remote description is applied, avoiding silent drops and one-way media. |
| Callee negotiation ordering | The implementation follows the recommended sequence: apply remote offer, flush queued ICE, attach local tracks, create and send the answer. |
| Session description objects missing a required `type` in serialisation edge cases | Descriptions are **normalised** so the browser API receives a valid `RTCSessionDescription`. |

These patterns are **documented in the engineering literature**; their inclusion here reflects **applied reliability work** for a care-oriented web prototype rather than a claim of fundamental novelty.

---

## 6. Mobile audio behaviour (including iOS)

Mobile browsers enforce **autoplay restrictions** on audio playback until a **user gesture** has occurred. The client therefore provides a **clear, user-triggered path** to start remote audio when automatic playback is blocked.

**Ringtone** handling uses the Web Audio API. On iOS, overlapping this path with microphone capture during accept can **degrade the audio session**; the implementation **stops the ringtone before** accepting the call and acquiring local media.

These behaviours should be framed in evaluation as **platform constraints** inherent to web-based interventions, not as defects unique to this codebase.

---

## 7. Background awareness and session catch-up

Web pages **cannot assume continuous execution** when the tab is backgrounded or the device has suspended aggressive timers. Incoming calls therefore rely on:

1. **Web Push** (VAPID), integrated with existing subscription management, delivering a payload that **deep-links** to the appropriate conversation (e.g. messaging route with peer identifier).
2. A **short time-to-live server store** for the pending **call offer**: if the callee reconnects after the initial offer, the server **replays** the offer to improve the chance of completing signalling.

**Scope statement:** Push provides **notification and deep-linking**, not parity with cellular circuit-switched ringing. Residual dependence on **OS notification policies** and user permission remains a **stated limitation**.

---

## 8. Caregiver client and progressive web application affordances

The **patient** client was already structured around **installable web** patterns. The **caregiver dashboard** included a **service worker** for push but initially lacked a **Web App Manifest** and associated **metadata** (icons, `theme-color`, Apple mobile web app tags). Those elements were added so that **install prompts**, **Add to Home Screen**, and **consistent installed-web behaviour**—particularly on iOS, where declarations strongly influence how web applications are treated—are **comparable** for both roles in the dyad.

**Positioning for thesis purposes:** The work should be described as **PWA-oriented deployment** or **progressive installability** for the caregiver surface—not as an assertion that two **feature-equivalent native-grade** applications were delivered. The design goal is **equitable mobile usability** and **reduced sampling bias** in user studies (e.g. only one cohort installing or pinning the client).

---

## 9. Optional loudspeaker routing

Where the user agent exposes **`HTMLMediaElement.setSinkId`**, the interface offers routing of **remote** playback to a speaker-class output. On platforms where the API is unavailable (commonly iOS), the control is **omitted** rather than advertised as unsupported behaviour.

---

## 10. User-visible diagnostic messaging

The client surfaces **explicit messages** for common failure classes: **microphone permission denial**, **signalling disconnection**, **ICE or media connection failure**, **invalid or expired call invitations**, and **user action** to enable remote audio after autoplay blocking. For caregiver- and patient-facing health informatics tools, **actionable feedback** supports trust, usability, and **cleaner qualitative data** when issues arise in study settings.

---

## 11. Limitations (summary)

- Call quality and connectivity depend on **network conditions** and **correct TURN provisioning**.
- **Permissions** (microphone, camera, notifications) remain end-user controlled.
- **Web push and background behaviour** are subject to **browser and OS policy**; ecological validity of trials should note **installed versus browser-tab** usage.

---

## 12. Code reference (appendix use)

| Concern | Location |
|---------|-----------|
| Peer connection and ICE handling (patient and caregiver implementations aligned) | `patient-app/src/hooks/useWebRTC.js`, `caregiver-dashboard/src/hooks/useWebRTC.js` |
| Signalling relay for call events | `backend/server.js` |
| Pending offer retention and push integration | `backend/src/utils/callIncoming.js` (invoked from `server.js`) |
| Push and notification-click navigation | `patient-app/public/sw.js`, `caregiver-dashboard/public/sw.js` |
| Caregiver install metadata | `caregiver-dashboard/public/manifest.webmanifest`, `caregiver-dashboard/index.html` |
| In-call user interface | `patient-app/src/components/CallOverlay.*`, `caregiver-dashboard/src/components/CallOverlay.*` |

---

*This document addresses **design intent** and **engineering trade-offs** only. It does not constitute empirical clinical validation of safety or effectiveness.*
