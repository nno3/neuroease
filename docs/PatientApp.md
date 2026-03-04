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

- **Email:** When the patient’s preference is “Email”, the backend sends an email at the reminder’s scheduled time. A scheduled job runs every 2 minutes, finds reminders that are due (and not yet completed), and for each patient with preference “email” sends one email via Nodemailer (SMTP). Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (see BackendSetUp.md). No SMS in scope. The preference is stored on the patient profile as `reminderNotificationChannel` (`email` | `push` | `none`).
- **In-app push:** Web Push notifications alert the patient when the app is in the background or closed. **In-app push works with “Add to Home Screen” (PWA)**—no native app install is required. The PWA runs in the browser; if the browser supports the Web Push API, the service worker requests permission and receives push. The patient app sends the push subscription to the backend; the reminder job sends a push payload when a reminder is due (using VAPID keys in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). When notifications are on (Email or In-app push), the patient is notified at the scheduled time and, if the reminder is not completed, receives a follow-up notification 15 minutes later.

**Limitations of in-app (Web) push**

- **iOS version:** Web Push in Safari (and for PWAs added to the home screen) is supported only on **iOS 16.4 and later**. Devices running **iOS earlier than 16.4 cannot receive in-app push notifications**. Users on older iOS should use **Email** as their reminder notification channel, or open the app to see reminders.
- **Permission:** The user must grant notification permission when choosing “In-app push”. If they deny or revoke permission, push will not be delivered until they re-enable it in browser/device settings.
- **Subscription expiry:** Push subscriptions can expire or be invalidated (e.g. after long inactivity, browser updates, or device changes). The app may need to re-prompt for permission and re-register the subscription; failed push sends can indicate an expired subscription.
- **Browser and environment:** Some older browsers, or private/incognito browsing, may not support Web Push or may not persist the subscription. Behaviour may vary by browser (Chrome, Safari, Firefox) and OS.

These limitations should be communicated to caregivers and patients where relevant (e.g. in app copy or caregiver docs) so that users on older iOS or with restricted browser settings can choose email instead.

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