# Patient app: accessibility design rationale


The implementation lives mainly in `patient-app/src/index.css`, `patient-app/src/utils/accessibilityPrefs.js`, `patient-app/src/main.jsx` (apply prefs on load), `patient-app/src/pages/Profile.jsx` (Display options UI), and `patient-app/src/components/Layout.jsx` / `Layout.css` (skip link, landmark structure, bottom navigation).

---

## 1. Design goals

The patient app targets **older adults and people living with cognitive impairment**, who often benefit from **larger touch targets**, **clear focus indicators**, **predictable motion**, and **text that can be enlarged** without relying solely on browser zoom. Choices below are **incremental**: they aim to reduce common friction on mobile web; they do **not** replace formal conformance evaluation.

---

## 2. Implemented measures and rationale

### 2.1 Text scaling (in-app “Display options”)

**What:** Three steps for root font size: default (~100%), “large” (~112.5%), “larger” (~125%), driven by `data-pa-text-scale` on `<html>` (`accessibilityPrefs.js`, `index.css`).

**Why:** Many users need larger type; scaling `html` font-size with `rem`-based UI propagates proportionally. This complements **browser zoom**, which can already enlarge content beyond 200% (WCAG success criterion **1.4.4 Resize Text**, Level AA), but in-app steps give a **consistent, one-tap** experience inside the app shell.

**References:** [1], [2].

### 2.2 Bolder body and heading weight

**What:** Optional `data-pa-bold` increases base `font-weight` and strengthens headings.

**Why:** Heavier type can improve **legibility** for low vision or mild contrast sensitivity. This is **not** a substitute for sufficient **contrast** (e.g. **1.4.3 Contrast (Minimum)**); default palette is chosen for reasonable contrast, but no automated audit is claimed.

**References:** [3], [4] ([4] is AAA).

### 2.3 Reduced motion (user toggle + operating system)

**What:** (1) In-app **Reduce animations** sets `data-pa-reduce-motion` and shortens `animation-*` / `transition-*` / `scroll-behavior` globally. (2) `@media (prefers-reduced-motion: reduce)` applies the same idea when the OS requests reduced motion.

**Why:** Motion and transitions can distract or trigger **vestibular** discomfort for some users. Respecting **`prefers-reduced-motion`** aligns with platform accessibility settings and with WCAG guidance on motion from interactions (**2.3.3**, Level AAA—treating it as **good practice** even when aiming at AA).

**References:** [5], [6].

### 2.4 Minimum touch target size

**What:** CSS variables and rules enforce **minimum height/width** (44px) for many buttons and controls; inputs use min-height consistent with touch comfort (`--pa-touch-min`).

**Why:** Small targets are hard to tap accurately, especially with **motor** variability. WCAG **2.5.8 Target Size (Minimum)** (Level AA in 2.2) sets a **24×24 CSS pixel** minimum; **2.5.5 Target Size** (Level AAA in 2.1) suggests **44×44**. The app **targets ~44px** as a **mobile-first** affordance stricter than 2.5.8’s minimum, without implying every exempt control is wrapped.

**References:** [7], [8]; practice also informed by [15].

### 2.5 Visible focus and standard form controls

**What:** `:focus-visible` outlines on links, buttons, and `.pa-btn`; focus styles on inputs.

**Why:** Keyboard and switch users need a **visible** focus indicator (**2.4.7 Focus Visible**, Level AA).

**References:** [9].

### 2.6 Skip link (“Skip to main content”)

**What:** First focusable control jumps to `#pa-main`.

**Why:** **Bypass Blocks** let keyboard users skip repeated chrome (**2.4.1**, Level A).

**References:** [10].

### 2.7 Landmark regions and semantics (partial)

**What:** Header uses `role="banner"`; main content uses `<main id="pa-main">`; call error/info uses `role="alert"` where appropriate.

**Why:** Landmarks and live regions help **assistive technologies** orient and announce **important state** (related to **4.1.3 Status Messages** where applicable).

**References:** [11], [12].

### 2.8 Bottom navigation: icon + text label

**What:** Tab items show a **Lucide** icon and a **text label** (Games, Reminders, Messages, Profile).

**Why:** Reduces reliance on **colour or position alone** to identify destinations; supports recognition and **1.3.3 Sensory Characteristics** (do not rely only on sensory characteristics—labels augment icons).

**References:** [13].

### 2.9 Zoom and text size adjustment

**What:** No `user-scalable=no` / restrictive maximum-scale in the app’s HTML shell; `-webkit-text-size-adjust: 100%` on `html`.

**Why:** Allowing pinch-zoom and OS text sizing supports **1.4.4** and general mobile accessibility.

**References:** [1].

### 2.10 Voice assistance (related, not WCAG-specific)

**What:** `VoiceAssistListener` supports **spoken commands** for navigation/tasks.

**Why:** Spoken interaction can help users who struggle with **fine motor** control or **visual search**; this is a **usability** and **inclusive design** feature. It is **not** equivalent to full **screen reader** compatibility or WCAG **4.1** compatibility on its own.

---

## 3. Explicit non-goals and removals

- **High-contrast themes** were **removed** from the product surface to avoid maintaining multiple colour systems without ongoing verification; default colours remain **designed** for Adequate contrast in common states, but **palette-level** claims are not audited here.
- **Caregiver dashboard** accessibility is **not** described in this document; parity should not be assumed.

---

## 4. Limitations (recommended disclosure)

1. **No full WCAG audit** (automated or manual) is asserted for the patient app.  
2. **Third-party content** (maps, embedded widgets) may introduce gaps.  
3. **Complex widgets** (real-time chat, WebRTC calling) need **focused** testing with **screen readers** and keyboard-only use.  
4. **Internationalisation** and **reading level** are separate from this technical note.

---

## 5. References (IEEE style)

Numbered citations refer to the following list [1]–[15]. Format follows common IEEE practice for online technical reports and documentation: bracketed number, author or organization, title, source, [Online]. Available: URL.

[1] W3C Web Accessibility Initiative, “Understanding Success Criterion 1.4.4: Resize Text,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html

[2] W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation, Dec. 12, 2024. [Online]. Available: https://www.w3.org/TR/WCAG22/

[3] W3C Web Accessibility Initiative, “Understanding Success Criterion 1.4.3: Contrast (Minimum),” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

[4] W3C Web Accessibility Initiative, “Understanding Success Criterion 1.4.6: Contrast (Enhanced),” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html

[5] W3C Web Accessibility Initiative, “Understanding Success Criterion 2.3.3: Animation from Interactions,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

[6] Mozilla, “prefers-reduced-motion,” *MDN Web Docs*. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

[7] W3C Web Accessibility Initiative, “Understanding Success Criterion 2.5.8: Target Size (Minimum),” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

[8] W3C Web Accessibility Initiative, “Understanding Success Criterion 2.5.5: Target Size (Enhanced),” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html

[9] W3C Web Accessibility Initiative, “Understanding Success Criterion 2.4.7: Focus Visible,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

[10] W3C Web Accessibility Initiative, “Understanding Success Criterion 2.4.1: Bypass Blocks,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html

[11] W3C Web Accessibility Initiative, “Understanding Success Criterion 4.1.3: Status Messages,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

[12] Mozilla, “ARIA live regions,” *MDN Web Docs*. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions

[13] W3C Web Accessibility Initiative, “Understanding Success Criterion 1.3.3: Sensory Characteristics,” *WCAG 2.2 Understanding Documents*, 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics.html

[14] W3C Web Accessibility Initiative, *WCAG 2.2 Understanding Documents* (index), 2024. [Online]. Available: https://www.w3.org/WAI/WCAG22/Understanding/

[15] Apple Inc., “Layout,” in *Human Interface Guidelines*. [Online]. Available: https://developer.apple.com/design/human-interface-guidelines/layout

---

## 7. Quick mapping table

| Implementation area        | Primary WCAG 2.2 touchpoint(s) (informative)                          | Ref.        |
|---------------------------|----------------------------------------------------------------------|------------|
| Text scale + zoom support | 1.4.4 Resize Text                                                   | [1], [2]   |
| Bold text option          | Supports legibility; contrast still 1.4.3                           | [3]        |
| Reduced motion            | 2.3.3 Animation from Interactions (AAA practice); OS `prefers-reduced-motion` | [5], [6] |
| 44px targets              | Stricter than 2.5.8; informed by 2.5.5 (AAA) / mobile HIG          | [7], [8], [15] |
| Focus visible             | 2.4.7 Focus Visible                                                 | [9]        |
| Skip link                 | 2.4.1 Bypass Blocks                                                 | [10]       |
| Icons + labels in nav     | 1.3.3 Sensory Characteristics; complements 1.4.1 Use of Color       | [13], [2]  |
| `role="alert"` banners    | 4.1.3 Status Messages (where dynamic status is announced)           | [11], [12] |

