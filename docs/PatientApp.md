# NeuroEase Patient App – Design Choices and Rationale

## 1. Introduction

The NeuroEase patient app is a mobile-first application for people living with cognitive impairment (including dementia) and their caregivers. Its main functions include viewing and completing reminders (medication, appointments, tasks) and engaging with simple games. The app is designed to be used over a prolonged period and must remain simple, predictable, and easy to use for people who may have reduced memory, attention, and motor skills [4]. This document records the design choices for the patient app and ties them to established principles from human–computer interaction (HCI) and accessibility literature, including design for elders and design for dementia.

---

## 2. Design Principles and References

The following principles guide the patient app design. They are drawn from literature on designing for elderly users and for people living with dementia, and from accessibility standards.

### 2.1 Reduction of Complexity

- **Few items per screen**: Limit the number of items on each working page (e.g. 2–5 items) so that the user is not overwhelmed [2].
- **Short, simple text**: Use short sentences and one idea per paragraph so that users can process information at their own pace [1], [2].
- **No multi-touch or complex gestures**: Avoid interactions that depend on fine motor control or multiple simultaneous actions [2].
- **Single task per page**: One page should support one main task so that the user always knows what they are doing [1], [2].

**Application in the app**: The Reminders screen is split into two clear sections—“Today” and “Upcoming”—with a small number of cards per section. Each card presents one reminder with a single primary action (“Mark as done”). There are no swipe gestures or multi-touch requirements. This simplicity supports autonomy and independent use, which technologies for dementia care should aim to maximise [4].

### 2.2 Clear Structure and Consistency

- **Key function unity**: One control performs one function [2].
- **Page function unity**: One page for one task [1], [2].
- **Consistent layout**: The same structure and control placement across screens and across items (e.g. every reminder card has the same layout and the same position for the action button) [1], [2].
- **Descriptive headings**: Headings and labels describe the content so that users can orient themselves [2].
- **Consistent navigation**: Navigation options (e.g. Reminders, Games, Profile) stay in the same order and place [2].

**Application in the app**: Every reminder card uses the same layout: icon and type, time and date, title, optional message, recurrence, then a fixed footer with either “Mark as done” or “Completed”. The action is always in the same place. Section headings “Today” and “Upcoming” clearly separate current tasks from future ones.

### 2.3 Use of Colour and Labelling

- **Colour to support, not replace, meaning**: Colour supports information presentation and distinguishes categories; text labels and icons are always present [2].
- **Contrast**: Text and interactive elements meet contrast requirements (e.g. WCAG) for users with declining vision [2], [3].
- **Avoid reliance on blue for state alone**: Use multiple cues (e.g. border, label, icon) [2].

**Application in the app**: Reminder cards are colour-coded by category: medication (light red/pink), appointment (light blue), task (light orange). Each card also shows a text label and an icon. Completed reminders use a distinct green. Colour supports quick scanning but is not the only way to tell categories apart.

### 2.4 Icons and Imagery

- **Clear, unambiguous icons**: Icons should be recognisable and consistent [2].
- **Icons with text**: Icons are used together with text labels [2].

**Application in the app**: Reminder types use distinct icons (e.g. pill, calendar, clipboard) paired with type labels on every card.

### 2.5 Feedback and Timing

- **Immediate feedback**: Button taps get immediate visual feedback [2].
- **Longer actions**: Show a wait indicator or progress message for actions over a couple of seconds [2].
- **Clear outcome**: After an action (e.g. marking a reminder done), the result is clearly indicated [2].

**Application in the app**: When the user taps “Mark as done”, the button shows “Updating…” while the request is in progress. On success, the card switches to “Completed” state. Errors are shown in plain language.

### 2.6 Minimising Errors and Supporting Recovery

- **Disable until due**: Actions that are not yet valid (e.g. marking a reminder done before its scheduled time) are disabled [2].
- **Clear error messages**: If something fails, the message is specific and suggests what to do [2].
- **Stable UI on error**: If an action fails, the list does not change; the user can retry [2].

**Application in the app**: In “Today”, “Mark as done” is enabled only when the current time is at or past the reminder’s scheduled time. In “Upcoming”, all “Mark as done” buttons are disabled. Disabled buttons have a tooltip indicating when the reminder becomes available. Failed API calls show an inline error; the list is not updated so the UI stays consistent.

### 2.7 Interface Optimisation for Elderly Users

- **Large touch targets**: Buttons and tappable areas meet minimum size guidelines (e.g. 44×44 px or 48×48 px) [2], [3].
- **Readable text**: Font size is at least 12 pt; left-aligned text is preferred [2].
- **Simple typography**: Sans-serif fonts and clear hierarchy [1], [2].
- **Operation area in centre**: Primary actions are placed where the user can focus without hunting [2].

**Application in the app**: The patient app uses a minimum touch target of 44 px for all primary buttons. Reminder cards use a full-width “Mark as done” button in a fixed footer. Font sizes support user zoom. Layout is left-aligned with a system sans-serif stack.

### 2.8 Today vs Upcoming and Date Filtering

- **Show only relevant items**: Showing only “today” and “upcoming” reminders reduces cognitive load [2].
- **Clear time context**: Dates and times are shown in a consistent format (e.g. “Today”, “Tomorrow”, “Mon 3 Feb”, “8:00 AM”) [2].

**Application in the app**: Reminders are filtered to today and future. They are split into **Today** (scheduled for today) and **Upcoming** (scheduled for a later date). Within Today, the user can only mark a reminder done when the current time has reached or passed its scheduled time. Upcoming reminders are shown for context but all actions are disabled until the scheduled date/time. Reminder systems are a recognised technology that can support autonomy and daily care for people with dementia [4].

### 2.9 Passwordless Authentication (No Password for Patients)

- **Do not rely on memory or complex cognitive skills for login**: People with dementia and cognitive impairment often forget passwords, struggle to type them correctly, and find multi-step login flows stressful [2], [6], [7]. Memory for arbitrary strings (passwords) is especially vulnerable in cognitive decline [7].
- **Prefer link-based or low-memory authentication**: Guidelines recommend logins that avoid memorisation and precise recall—for example, clicking a link sent by email or SMS, or using a trusted device [6]. Email-link (magic-link) and invite-link flows remove the need to remember or type a password [6], [7].

**Application in the app**: The patient app uses **no password**. Access is by:

1. **First-time activation**: The caregiver sends an **invite link** by email from the dashboard. The patient (or a helper) opens the link in the browser; the app validates the token and signs them in immediately. No form to complete and no password to create or remember.
2. **Later logins**: From the login screen, the patient enters only their **email** and taps “Send login link”. They then open the link from their email (or have a carer open it). Again, no password is required. If the app was **added to the home screen** (PWA), the link may open in the browser instead of the installed app; in that case, the same email includes a **6-digit code**. The user opens the app from the home screen and enters their email and that code to log in there, so they never need to rely on the link opening in the right place.

**Why we added the 6-digit login code (and how it is generated)**  
When the patient uses the app as a PWA (e.g. “Add to Home Screen” in Safari), the magic link from the email is opened by the OS and typically opens in the **browser** (Safari), not in the installed app. The browser and the home-screen app use **separate storage** (cookies/localStorage are not shared). So the patient ends up logged in inside Safari but not inside the app they opened from the home screen, and the app asks for login again. To fix this without requiring the link to open “in the app” (which is unreliable on iOS), we send a **one-time 6-digit code** in the same email as the magic link. The patient can stay in the home-screen app and log in by entering their email and this code; the code is validated on the backend and returns the same JWT as the magic link.  

- **How the code is generated:** The backend generates a **random 6-digit numeric code** when sending the login email. It is produced as `100000 + Math.floor(Math.random() * 900000)` so the value is always between 100000 and 999999 (no leading zeros, easy to type and read). The code is stored on the user record (`magic_link_short_code`) with the **same 15-minute expiry** as the magic link token. It is **single-use**: after successful verification (or when the magic link is used), the code and magic link token are both cleared.  
- **Security:** The code is only valid together with the correct email, is time-limited (15 minutes), and is invalidated after one successful use. It is sent only to the patient’s email address.

This approach aligns with W3C guidance to “provide a login that does not rely on memory or other cognitive skills” [6] and with research showing that people with cognitive impairments need authentication that does not depend on recalling or entering passwords [7]. Technologies for dementia care should maximise autonomy and minimise unnecessary cognitive demand [4]; passwordless, link-based login supports that goal.

### 2.10 Reminder Notifications (Email and In-App Push)

Patients can be notified when a reminder is due via **email** or **in-app (Web) push**. The patient chooses their preferred method in the app **Profile** screen (Email, In-app push, or None). **Caregivers cannot change this**—they can only view the patient’s choice on the dashboard (patient form, Care & Emergency tab). No password or app-store install is required; the app is used as a PWA added to the home screen (“Add to Home Screen”).

- **Email:** When the patient’s preference is “Email”, the backend sends an email at the reminder’s scheduled time. A scheduled job runs every 1 minute, finds reminders that are due (and not yet completed), and for each patient with preference “email” sends one email via Nodemailer (SMTP). Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (see BackendSetUp.md). No SMS in scope. The preference is stored on the patient profile as `reminderNotificationChannel` (`email` | `push` | `none`).
- **In-app push:** Web Push notifications alert the patient when the app is in the background or closed. **In-app push works with “Add to Home Screen” (PWA)**—no native app install is required. The PWA runs in the browser; if the browser supports the Web Push API, the service worker requests permission and receives push. The patient app sends the push subscription to the backend; the reminder job sends a push payload when a reminder is due (using VAPID keys in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). When notifications are on (Email or In-app push), the patient is notified at the scheduled time and, if the reminder is not completed, receives a follow-up notification 15 minutes later.

**Limitations of in-app (Web) push**

- **iOS version:** Web Push in Safari (and for PWAs added to the home screen) is supported only on **iOS 16.4 and later**. Devices running **iOS earlier than 16.4 cannot receive in-app push notifications**. Users on older iOS should use **Email** as their reminder notification channel, or open the app to see reminders.
- **Permission:** The user must grant notification permission when choosing “In-app push”. If they deny or revoke permission, push will not be delivered until they re-enable it in browser/device settings.
- **Subscription expiry:** Push subscriptions can expire or be invalidated (e.g. after long inactivity, browser updates, or device changes). The app may need to re-prompt for permission and re-register the subscription; failed push sends can indicate an expired subscription.
- **Browser and environment:** Some older browsers, or private/incognito browsing, may not support Web Push or may not persist the subscription. Behaviour may vary by browser (Chrome, Safari, Firefox) and OS.

These limitations should be communicated to caregivers and patients where relevant (e.g. in app copy or caregiver docs) so that users on older iOS or with restricted browser settings can choose email instead.

### 2.11 Voice-Assist Reminders

Voice-assist lets patients hear their reminders read aloud using text-to-speech. It is an accessibility feature aligned with design for dementia and cognitive impairment [2], [4].

**Rationale: why audio helps.** Academic research supports the use of audio and verbal prompts for people with dementia and mild cognitive impairment (MCI). Technology-based prompting studies have found that **text and audio prompts were more effective than video or picture prompts** for helping people with dementia complete multistep tasks at home [8]. A more recent experimental study found that **audible verbal instructions were significantly more useful** for task completion than tone-based or visual-only prompts [9]. Verbal prompting has also been shown to improve everyday cognition (medication management, finances, telephone use) in older adults with MCI and unimpaired elders over longitudinal follow-up [10]. Smartphone reminder applications designed for people with MCI and dementia—delivering auditory alarms and verbal reminders—have demonstrated improved task completion and reduced reliance on written cues [11]. This evidence supports NeuroEase’s voice-assist feature as a modality that can increase the likelihood that reminders are perceived and acted upon by the target demographic.

There are two ways to trigger it:

1. **On push:** When the patient receives an in-app push notification and opens the app, the reminder is read aloud automatically (if the feature is enabled in Profile).
2. **Manual Read aloud:** On the Reminders page, a "Read aloud" button speaks all current reminders (overdue, due today, upcoming) in order.

Both use the Web Speech API (`SpeechSynthesis`) with voice and speed options chosen in Profile.

**Browser support (spoken text vs notification sound).** Behaviour is **not identical across browsers and platforms.** In **Google Chrome**, when the app is **installed** (PWA: “Install app” / Add to Home Screen from Chrome), **Read aloud**, **Test speech** in Profile, and automatic speech when enabled work as expected: the device speaks reminder text using the chosen voice and speed. This is the recommended reference environment for demonstrating spoken reminders. **Safari on iPhone/iPad** still supports `SpeechSynthesis` for Read aloud and Profile speech, but **Web Push notification sounds** are limited to Apple’s **default short system tone** for web apps—custom notification sounds are not available for PWAs on iOS, which is separate from whether **spoken** text works once the user opens the app or uses Read aloud. Other browsers may differ in volume routing, permissions, or speech voice availability. For assessment documentation: **spoken reminders are supported and work well in an installed Chrome PWA**; note **cross-browser differences** for push tones and iOS specifically.

### Options considered for “which reminder to speak” (on push)

When a push arrives and the user opens the app, we need to know which reminder to speak. Three options were considered:

- **Option A (chosen):** Include `reminderId`, `title`, and `body` in the push payload. The service worker stores this in IndexedDB when it receives the push; the main page reads it on visibility change or mount.
- **Option B:** Backend exposes `GET /api/reminders/recently-notified?since=ISO8601` returning reminders push-sent in the last 5–10 minutes. The page fetches on visibility and speaks any not yet spoken.
- **Option C:** Heuristic: fetch due/overdue reminders when visible; speak the first (or all) not yet marked as "spoken" this session.

### Why we chose Option A

- **No extra API:** No backend endpoint or database query needed; the push payload carries everything required.
- **Accurate:** We speak the exact reminder that triggered the push, not an inferred or recently-fetched list.
- **Works offline:** IndexedDB is local; the page can read pending data even if the network is slow or unavailable.
- **Immediate for open app:** When the app is already open and a push arrives, the service worker can `postMessage` to the client with the reminder data; the page speaks immediately without waiting for a fetch.

### Implementation

- **Backend:** The reminder job (`reminderEmailJob.js`) includes `reminderId`, `title`, and `body` in the push payload sent via the push service.
- **Service worker (`sw.js`):** On `push`, parses the payload. If `reminderId` is present, stores `{ reminderId, title, body, pushedAt }` in IndexedDB (`neuroease-voice-assist` DB, `pending` store). If the app has an open client, sends `postMessage({ type: "voice-assist-push", reminderId, title, body })` so the page can speak right away. On `notificationclick`, opens the app (or focuses existing window).
- **Main app:** `VoiceAssistListener` (mounted in Layout) listens for (1) SW `postMessage` when a push arrives while the app is open; (2) `visibilitychange` when the user returns to the app; (3) mount with a short delay (when the user opens the app from a notification click). In each case, it fetches the pending reminder from IndexedDB (and clears it), checks the Profile opt-in and debounce interval, then calls `speakReminderIfNew`.
- **Settings (Profile):** Checkbox "Read reminders aloud when I open the app" (stored in `localStorage`). Voice dropdown (English voices from `speechSynthesis.getVoices()`, deduplicated by name+lang). Speed dropdown (Slower / Normal / Faster). "Test voice" button to verify TTS.
- **Deduplication:** `sessionStorage` tracks which reminder IDs have been spoken this session; we do not re-speak when the user switches tabs and comes back.
- **Debouncing:** A minimum 2-second interval between speaks avoids rapid repeated announcements.

### Read aloud button on Reminders page

A second, manual trigger was added so patients can hear all current reminders read aloud when they open the app (e.g. without receiving a push). The button shows "Read aloud" with a volume icon; when clicked, it speaks overdue, due today, and upcoming reminders in order. While speaking, the button changes to "Stop" so the user can cancel. Uses the same voice and speed settings from Profile.

### Voice and speed options

Users can choose from available English system voices (e.g. Samantha, Daniel) and set speed (Slower, Normal, Faster). These apply to both push-triggered speech and the Read aloud button. We filter to English voices and deduplicate entries that appear multiple times in the browser’s voice list.

### Limitations

- **User gesture:** Some browsers (e.g. iOS Safari) may require a user interaction before `speechSynthesis.speak()` can start. Tapping the push notification to open the app counts as a user gesture.
- **Foreground only:** TTS runs only when the page is in the foreground. We cannot speak when the app is closed or in the background.
- **Browser support:** `SpeechSynthesis` is well-supported but behaviour varies by browser and OS. Test on target devices (iOS Safari, Android Chrome).
- **Screen readers:** Users who use a screen reader may hear duplicate announcements. Voice-assist is intended for users who do *not* use a screen reader.

### 2.12 Cognitive Games (Memory Match, Math)

The patient app includes cognitive games (Memory Match, and planned Math) to support cognitive stimulation and engagement for people with dementia and MCI. Games are accessible from the Games section in the bottom navigation.

**Rationale and design:** See [CognitiveGames_Dementia.md](./CognitiveGames_Dementia.md) for a full explanation of why we included a memory game, how it helps people with dementia, and the design choices (large cards, familiar images, simple rules, session saving) that make it dementia-friendly.

---

## 3. Technology and Implementation Notes

The implementation follows guidelines for developing technologies for dementia care [4]. Key choices include:

- **Icons**: The app uses inline SVGs or an icon library for reminder types (pill, calendar, clipboard, checkmark) so that no single external icon package is required; icons are paired with text labels.
- **Plain CSS**: Styles use CSS variables for colours and touch targets. Category colours are defined in `:root` (e.g. `--pa-reminder-medication-bg`, `--pa-reminder-appointment-border`).
- **Mobile-first**: Layout and touch targets are designed for small screens (e.g. 375 px width) first, with support for zoom and high contrast.

---

## 4. References

[1] “Designing age-friendly mobile apps: Insights from a mobility app study,” *Educ. Gerontol.*, 2023. [Online]. Available: [https://www.tandfonline.com/doi/full/10.1080/01924788.2023.2213028](https://www.tandfonline.com/doi/full/10.1080/01924788.2023.2213028). DOI: [10.1080/01924788.2023.2213028](https://doi.org/10.1080/01924788.2023.2213028)  
(Age-friendly mobile design, usability with older adults, and design insights from mobility apps; supports reduction of complexity, clear structure, consistency, feedback, ease of use, and interface optimisation for elders.)

[2] AbilityNet, “Designing for dementia,” AbilityNet Factsheet, Feb. 2025.  
[https://abilitynet.org.uk/factsheets/designing-dementia](https://abilitynet.org.uk/factsheets/designing-dementia)  
(Dementia-friendly design: structure, simple language, text styling, contrast, icons, avoiding distractions, processing time.)

[3] W3C, “Web Content Accessibility Guidelines (WCAG) 2.1,” W3C Recommendation, Jun. 2018.  
[https://www.w3.org/TR/WCAG21/](https://www.w3.org/TR/WCAG21/)  
(Contrast ratios, touch target size, and non-reliance on colour alone.)

[4] W. Moyle, “The promise of technology in the future of dementia care,” *Nat. Rev. Neurol.*, vol. 15, no. 6, pp. 353–359, Jun. 2019. [Online]. Available: [https://pubmed.ncbi.nlm.nih.gov/31073242/](https://pubmed.ncbi.nlm.nih.gov/31073242/). DOI: [10.1038/s41582-019-0188-y](https://doi.org/10.1038/s41582-019-0188-y)  
(Technology and future dementia care; guidelines for development and implementation of technologies for older adults with cognitive decline.)

[5] Lucide, “Lucide,” Lucide Icons.  
[https://lucide.dev/](https://lucide.dev/)  
(Icon library used in the caregiver dashboard and optionally in the patient app for reminder types and status.)

[6] W3C, “Cognitive Accessibility Design Pattern: Provide a Login that Does Not Rely on Memory or Other Cognitive Skills,” in *Making Content Usable for People with Cognitive and Learning Disabilities* (Supplement to WCAG), W3C Group Note.  
[https://www.w3.org/WAI/WCAG2/supplemental/patterns/o6p01-login-cognition/](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o6p01-login-cognition/)  
(Recommends logins that avoid reliance on memory; suggests email/phone link authentication, WebAuthn, biometrics, or trusted devices instead of passwords for users with cognitive or learning disabilities.)

[7] A. Gruebler, K. Takayama, and T. Nakagawa, “’I Always Have to Think About It First’: Authentication Experiences of People with Cognitive Impairments,” in *Proc. 20th Int. ACM SIGACCESS Conf. Comput. Access.* (ASSETS ’18), 2018, pp. 407–409. [Online]. Available: [https://dl.acm.org/doi/10.1145/3132525.3134788](https://dl.acm.org/doi/10.1145/3132525.3134788). DOI: 10.1145/3132525.3134788  
(Study of authentication experiences of people with cognitive impairments; highlights difficulties with passwords and recall, and the need for authentication that does not depend on memory.)

[8] L. Boyd, J. Evans, R. Orpwood, and N. Harris, "Using simple technology to prompt multistep tasks in the home for people with dementia: An exploratory study comparing prompting formats," *Dementia*, vol. 16, no. 4, pp. 424–442, 2016. [Online]. Available: [https://journals.sagepub.com/doi/10.1177/1471301215602417](https://journals.sagepub.com/doi/10.1177/1471301215602417). DOI: [10.1177/1471301215602417](https://doi.org/10.1177/1471301215602417)  
(Compared text, audio, video, and picture prompts for people with dementia completing multistep tasks at home; text and audio prompts were more effective than video or picture prompts for task types where actions could be conveyed verbally.)

[9] T. Cannings, S. Brookman, R. Parker, L. Hoon, K. Ono, T. Kawata, N. Matsukawa, and N. Harris, "Optimizing Technology-Based Prompts for Supporting People Living With Dementia in Completing Activities of Daily Living at Home: Experimental Approach to Prompt Modality, Task Breakdown, and Attentional Support," *JMIR Aging*, vol. 7, e56055, Aug. 2024. [Online]. Available: [https://aging.jmir.org/2024/1/e56055/](https://aging.jmir.org/2024/1/e56055/)  
(Experimental study of technology-based prompts for people with dementia; audible verbal instructions were significantly more useful for task completion than tone-based or visual-only prompts; granular task breakdown improved independent use.)

[10] K. R. Thomas and M. Marsiske, "Verbal prompting to improve everyday cognition in MCI and unimpaired older adults," *Neuropsychology*, vol. 28, no. 1, pp. 123–134, 2014. [Online]. Available: [https://pmc.ncbi.nlm.nih.gov/articles/PMC3935329/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3935329/). DOI: [10.1037/neu0000039](https://doi.org/10.1037/neu0000039)  
(Longitudinal study of 2,802 older adults; standardized verbal prompts improved performance on everyday cognition tasks involving medication management, finances, and telephone use across 10-year follow-up, including those with MCI.)

[11] K. Hackett et al., "Remind Me To Remember: A pilot study of a novel smartphone reminder application for older adults with dementia and mild cognitive impairment," *Neuropsychol. Rehabil.*, vol. 32, no. 1, pp. 22–50, 2020. [Online]. Available: [https://pmc.ncbi.nlm.nih.gov/articles/PMC7854961/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7854961/). DOI: [10.1080/09602011.2020.1794909](https://doi.org/10.1080/09602011.2020.1794909)  
(Pilot study of SmartPrompt smartphone reminder app with auditory alarms and visual reminders for people with MCI and dementia; participants completed significantly more tasks (93% vs 56%) when using the app; checking written cues decreased by 87%.)