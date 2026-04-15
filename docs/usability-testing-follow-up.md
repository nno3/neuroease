# Follow-up changes after NeuroEase usability testing

This note records **product and UI responses** to feedback from the **NeuroEase usability study (participant questionnaire, March 2026)**. 

Earlier iterations (outside this document) already addressed other comments, including **patient app accessibility** (text scale, reduced motion, bold text), **longer patient JWT sessions**, **automatic logout on expired tokens**, **patient details from Messages (caregiver)**, and the **Edit Patient modal tabs** (one panel per tab instead of one long scroll where “Medical” still showed Personal content when scrolling).

---

## 1. “Completed” vs “Completed late” was unclear

**Feedback:** Participants could not easily tell the difference without checking timestamps; labels alone were insufficient.

**Response:**

- **Patient app (`Reminders`):** The completion row (“Completed” / “Completed late”) shows a **second line of plain text** under the status (always visible) so **phone users** see the explanation—**`title` tooltips are poor on touch** and were easy to miss. Reminder **type** is **text under the time/date** only (one cue), with **card colour/border**—no duplicate type icons.
- **Caregiver dashboard (`Reminders` schedule cards):** Occurrence status now distinguishes **completed on time** vs **completed late** (using `completedAt` vs the occurrence’s scheduled moment), shows **“Completed late”** in **amber**, and adds the same style of **`title` tooltip** on the status line.
- **Patient Activity modal:** Status badges use **title tooltips**; **“Completed late”** is visually separated from **“Completed”** (amber vs green). Meta line **reminder types** use icons and labels (see section 2).

**Note:** On **patient** Reminders, completion help is **visible copy**, not only tooltips. The **caregiver** schedule still uses `title` on status for a quick desktop hover hint in addition to wording.

---

## 2. Stronger cues for reminder types (medication / appointment / task)

**Feedback:** Request for clearer differentiation between reminder kinds (including use of icons).

**Response:**

- **Patient app:** Reminder type appears as **label text under the scheduled time** (and optional **Overdue** line there); the **caregiver dashboard** still uses **type chips** on schedule cards where screen space differs.
- **Caregiver dashboard — schedule list:** Each card has a **coloured left border** by type, a **type chip** (icon + label) **above the title**, and the redundant **type repeated in parentheses** on the recurrence row was **removed** to reduce clutter.
- **Patient Activity modal:** Raw `reminderType` strings were replaced with **human labels** and **small icons** with **type-coloured** emphasis.

Colour is **not** the only signal; **icon + text** are always present.

---

## 3. Items noted in testing but not fully “closed” in code

The questionnaire also mentioned **Read aloud discoverability**, **Activity page density / badges**, **optional reminder location**, **navigation depth**, **games access on small screens**, **map / safe zone clarity**, and **broader alerting**. Those remain **partially or wholly open**; they can be listed under **future work** in the thesis unless implemented later.

---

## 4. Bug fix during testing: daily reminder starting tomorrow appeared today

**Feedback (session):** After adding a **daily** reminder whose **first occurrence was tomorrow**, it incorrectly appeared in **today’s** schedule.

**Response:** Scheduling logic now treats **daily** series as starting on the **calendar day of `scheduledTime`**. Before that day, only the **first** scheduled instant exists (e.g. tomorrow at the chosen time); on and after the start day, “today” shows **today at the same clock time**. The same idea is applied where reminders are expanded for **email jobs** and the **caregiver calendar / per-day occurrence** helpers so behaviour stays consistent.

**Traceability:** Fix carried in work based on commit `df66a3d9`.

---

## 5. Traceability

| Area | Main files |
|------|------------|
| Patient reminders — tooltips & type chips | `patient-app/src/pages/Reminders.jsx`, `patient-app/src/pages/Reminders.css` |
| Caregiver reminders — status detail, chips, borders | `caregiver-dashboard/src/pages/Reminders.jsx`, `caregiver-dashboard/src/pages/Reminders.css` |
| Activity modal — types & status tooltips | `caregiver-dashboard/src/components/PatientActivityModal.jsx`, `PatientActivityModal.css` |
| Daily series start (first occurrence not “today”) | `patient-app/src/pages/Reminders.jsx` (`getEffectiveOccurrence`), `caregiver-dashboard/src/pages/Reminders.jsx` (`doesReminderOccurOnDate`, `getOccurrenceTime`), `backend/src/jobs/reminderEmailJob.js` (`getCurrentDailyOccurrence`) |


