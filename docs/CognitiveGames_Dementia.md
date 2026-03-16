# Cognitive Games in NeuroEase – Rationale for People with Dementia

## 1. Introduction

NeuroEase includes cognitive games (Memory Match, and planned Math) to support people living with dementia and mild cognitive impairment (MCI). Cognitive stimulation is a recognised non-pharmacological intervention that can support cognition and engagement [1], [2]. Games are integrated into the patient app alongside reminders so caregivers can encourage play and monitor engagement through the dashboard.

---

## 2. How Memory Games Help People with Dementia

### 2.1 Cognitive Stimulation

- **Working memory and attention**: Card-matching games require the player to remember card positions and hold information in mind while searching for pairs. This engages working memory and sustained attention, cognitive domains often affected in dementia [1].
- **Visual recognition**: Using familiar, everyday images (e.g. fruit) supports recognition rather than recall, which is typically easier for people with memory impairment [2].
- **Structured activity**: A clear, rule-based task (flip, match, repeat) provides structure that can reduce confusion and support engagement [3].

### 2.2 Engagement and Wellbeing

- **Meaningful activity**: Simple games can provide a sense of accomplishment and purpose, which supports emotional wellbeing [2].
- **Routine and familiarity**: Repeating a familiar game can be comforting and reduce anxiety [3].
- **Social connection**: Caregivers can play alongside or encourage the person, turning the game into a shared activity [4].

### 2.3 Monitoring and Care Planning

- **Session data**: Game sessions (score, duration, accuracy) are saved to the backend so caregivers can see how often the person plays and how they perform over time.
- **Activity feed**: The caregiver dashboard shows recent game activity, supporting awareness of engagement and potential changes in cognition or interest.

---

## 3. Design Choices for Dementia-Friendly Memory Match

The Memory Match game in NeuroEase is designed to be usable and enjoyable for people with dementia. Key choices align with design principles for elders and people with cognitive impairment [2], [5]:

| Design choice | Rationale |
|---------------|-----------|
| **Large cards, full-width grid** | People with dementia may have reduced vision and motor control. Large touch targets (44px minimum) and big, easy-to-see images reduce frustration and support success [2], [5]. |
| **Minimal gaps, no scrolling** | All 16 cards fit on one screen. Reducing cognitive load and avoiding the need to remember where cards are off-screen [2]. |
| **Familiar fruit images** | Recognisable, everyday objects (apple, banana, etc.) are easier to process than abstract symbols [2]. |
| **Simple rules** | One action per tap (flip a card); clear goal (find pairs). No multi-step or complex gestures [2]. |
| **Immediate feedback** | Cards flip and match clearly; correct/incorrect is obvious. Supports learning and reduces uncertainty [2]. |
| **Pause and restart** | Users can pause if distracted and resume when ready. Reduces pressure and supports self-paced use. |
| **Clear navigation** | "Back to games" and "Play again" are explicit and easy to find. Supports orientation and reduces confusion [2]. |
| **Session saving** | Game results are stored so caregivers can see engagement without requiring the person to report it. |
| **Victory delay (1.5 s)** | When the last pair matches, the game waits 1.5 seconds before showing the victory overlay. This lets the user see both cards flipped and the match complete before celebrating. Immediate overlay would obscure the final match and reduce the sense of completion [2]. |
| **Sound feedback** | Correct/incorrect sounds (Math) and victory sound (Memory) provide multimodal feedback. Research shows that "feedback prompts for every action performed are critical for successful perception and task completion" in people with dementia [6]. Users can turn sound effects on or off in Profile. |
| **Consistent victory UI** | Both games use the same feedback modal style: green success border, checkmark icon, clear message, and large action buttons. Familiar patterns reduce cognitive load. |

---

## 4. Sound Effects and Profile Toggle

Sound effects (correct/incorrect in Math, victory in Memory) support accessibility through multimodal cues. The patient can enable or disable game sounds in **Profile → Game sound effects**. When enabled, sounds play for:

- **Math Practice**: correct answer, wrong answer
- **Memory Match**: victory when all pairs are matched

The setting is stored in localStorage and applies across all games. Default: **on**.

### Why no sound on card mismatch (Memory Match)

Memory Match does *not* play a sound when the user flips two cards that do not match. Rationale:

- **Mismatches are expected**: In a matching game, players explore cards to find pairs. Many mismatches are part of normal play, not "wrong answers." Unlike Math Practice (where an incorrect answer is a calculation error), mismatches are routine discovery.
- **Avoid discouragement**: A negative sound on every mismatch could feel punitive or frustrating, especially for people who make many mismatches before completing the game. It may increase anxiety or reduce enjoyment.
- **Visual feedback is sufficient**: The cards visibly flip back after a mismatch (with a short delay), which clearly signals "no match." Adding a wrong sound could be redundant and, in combination with the visual, feel overly negative.
- **Positive reinforcement focus**: Playing sound only on victory keeps the emphasis on success and completion, which supports motivation and a sense of accomplishment [2].

If stronger audio feedback for mismatches is desired in future, consider a neutral "try again" tone rather than a harsh "wrong" sound.

---

## 5. Math Practice – Difficulty Levels

Math Practice offers three difficulty levels that control the number range for each operation. Caregivers and patients can choose the level that best matches the person’s ability and comfort.

| Level | Addition | Subtraction | Multiplication | Division |
|-------|----------|-------------|-----------------|----------|
| **Easy** | Numbers 1–5 | Numbers 1–6 | Numbers 1–4 | Numbers 1–4 |
| **Normal** | Numbers 1–10 | Numbers 1–10 | Numbers 1–6 | Numbers 1–5 |
| **Hard** | Numbers 1–15 | Numbers 1–15 | Numbers 1–10 | Numbers 1–10 |

**What each level means:**

- **Easy**: Smaller numbers throughout. Best for people who are new to the game, have more advanced dementia, or prefer lower cognitive load. Equations stay within single-digit or very small double-digit results.
- **Normal**: Standard range. Suitable for most users with mild to moderate cognitive impairment who can work with numbers up to about 10.
- **Hard**: Larger numbers and more challenging arithmetic. For users who find Normal too easy and want to maintain or stretch their skills. Results can reach double digits (e.g. 12×8, 90÷9).

The difficulty is chosen on the Math Practice start screen before selecting an operation. It applies to the entire session and can be changed when starting a new game.

### Rationale for number ranges

The three levels are informed by research on arithmetic-based cognitive training for older adults and people with cognitive impairment. Nouchi et al. [7] describe “learning therapy”—a validated intervention using reading aloud and solving simple arithmetic calculations. In that programme, *the lowest level of difficulty was simple addition (e.g. 1 + 3)* and *the highest level was three-figure division (e.g. 156 ÷ 3)*. The authors selected *extremely simple and easy tasks* to avoid psychological stress during training, and used *systematized basic problems in arithmetic* with difficulty adjusted so participants could solve problems *with ease and without mental stress*. NeuroEase’s Easy level aligns with that “lowest difficulty” idea (single-digit operations, small results). Normal uses a standard range within 10, common in foundational arithmetic. Hard extends to larger numbers and double-digit results for users who need more challenge while remaining within manageable bounds.

---

## 6. Limitations and Future Work

- **Cognitive games are not a cure**: They are a supportive activity, not a treatment. Benefits vary by individual and stage of dementia [1].
- **Not suitable for everyone**: Some people may find games frustrating or uninteresting. Caregivers should use judgement and not pressure use [3].

---

## 7. References

[1] C. Meyer and F. O'Keefe, "Non-pharmacological interventions for people with dementia: A review of reviews," *Dementia (London)*, vol. 19, no. 6, pp. 1927–1954, Aug. 2020. [Online]. Available: [https://pubmed.ncbi.nlm.nih.gov/30526036/](https://pubmed.ncbi.nlm.nih.gov/30526036/). DOI: [10.1177/1471301218813234](https://doi.org/10.1177/1471301218813234)  
(Review of systematic reviews; cognitive stimulation and reminiscence improved cognition; strongest evidence for reducing responsive behaviours and emotional disorders.)

[2] AbilityNet, "Designing for dementia," AbilityNet Factsheet, Feb. 2025. [Online]. Available: [https://abilitynet.org.uk/factsheets/designing-dementia](https://abilitynet.org.uk/factsheets/designing-dementia)  
(Guidelines for designing digital interfaces for people with dementia; large targets, simple structure, clear feedback.)

[3] W. Moyle, "The promise of technology in the future of dementia care," *Nat. Rev. Neurol.*, vol. 15, no. 6, pp. 353–359, Jun. 2019. [Online]. Available: [https://pubmed.ncbi.nlm.nih.gov/31073242/](https://pubmed.ncbi.nlm.nih.gov/31073242/). DOI: [10.1038/s41582-019-0188-y](https://doi.org/10.1038/s41582-019-0188-y)  
(Overview of technology in dementia care; supports meaningful, person-centred activities that maximise autonomy.)

[4] H. C. Boyd, N. M. Evans, R. D. Orpwood, and N. D. Harris, "Using simple technology to prompt multistep tasks in the home for people with dementia: An exploratory study comparing prompting formats," *Dementia (London)*, vol. 16, no. 4, pp. 424–442, May 2017. [Online]. Available: [https://pubmed.ncbi.nlm.nih.gov/26428634/](https://pubmed.ncbi.nlm.nih.gov/26428634/). DOI: [10.1177/1471301215602417](https://doi.org/10.1177/1471301215602417)  
(Exploratory study of prompting formats; text and audio prompts more effective than video or picture for some tasks; emphasises simple, tailored technology and caregiver involvement.)

[5] W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," W3C Recommendation, Jun. 2018.  
(Minimum touch target size, contrast, and clear feedback for accessibility.)

[6] Frontiers in Sports and Active Living, "Enhancing prompt perception in dementia: a comparative study of mixed reality cue modalities," 2024.  
(Feedback prompts for every action are critical for successful perception and task completion in people with dementia; multimodal cues support accessibility.)

[7] R. Nouchi et al., "Reading Aloud and Solving Simple Arithmetic Calculation Intervention (Learning Therapy) Improves Inhibition, Verbal Episodic Memory, Focus Attention and Processing Speed in Healthy Elderly People: Evidence from a Randomized Controlled Trial," *Front. Hum. Neurosci.*, vol. 10, art. 217, May 2016. [Online]. Available: [https://doi.org/10.3389/fnhum.2016.00217](https://doi.org/10.3389/fnhum.2016.00217)  
(RCT of “learning therapy” (reading aloud + simple arithmetic) in older adults; lowest difficulty: single-digit addition e.g. 1+3; highest: three-figure division e.g. 156÷3; tasks selected to be simple and low-stress; supports scaffolding from single-digit to harder arithmetic.)

---

## 8. Game Metrics & Performance Analytics

### 8.1 How Each Game Records Data

Each game session is saved to the backend (`POST /api/games`) with four fields: `gameType`, `score`, `duration`, and `accuracy`. However, **score and accuracy mean fundamentally different things** between the two games:

| Field | Math Practice | Memory Match |
|-------|--------------|--------------|
| `score` | Number of questions answered correctly (unbounded, higher = better) | Total card flips/moves to complete the game (unbounded, **lower = better**) |
| `accuracy` | `correctAnswers / totalAttempts` (0.0–1.0) | `totalPairs / moves` (0.0–1.0, pair efficiency) |
| `duration` | Session length in seconds | Session length in seconds |
| Direction | Higher score + higher accuracy = better | **Lower** score + higher accuracy = better |

**Accuracy is `null`** when a patient opens the game but quits before interacting (0 attempts in Math, or 0 moves in Memory). This is common with dementia patients who may become confused or distracted before gameplay begins.

### 8.2 Why the Performance Chart Separates Game Types

The caregiver dashboard's performance trend chart lets caregivers toggle between **Math Practice** and **Memory Match** rather than combining them into one view. This is a deliberate design decision for three reasons:

#### Score semantics are incompatible

Averaging Math scores (correct answers, higher = better) with Memory scores (moves, lower = better) produces a meaningless number. A combined average of 10 could mean "10 correct math answers" (good) or "10 moves in memory" (excellent) — the caregiver cannot tell.

#### Different cognitive domains

The games target different cognitive abilities. Research on dementia monitoring emphasises tracking **specific cognitive domains** separately rather than collapsing them into a single composite score [1]:

- **Math Practice** → executive function, working memory, processing speed
- **Memory Match** → visuospatial memory, pattern recognition

A patient improving in memory but declining in math would be invisible on a combined chart. Separating them allows caregivers and clinicians to identify which specific abilities are changing.

#### Chart axis handling

For Math Practice, the score Y-axis runs bottom-to-top (higher = better). For Memory Match, the score axis is **inverted** (lower = better, line going down indicates improvement with fewer moves needed). This inversion is handled automatically when the caregiver switches game type via the toggle.

### 8.3 Handling Incomplete Sessions

The `sessionsWithAccuracy` field tracks how many sessions actually contain gameplay data (accuracy ≠ null). When this differs from the total session count, the callout explains the discrepancy:

- **Correct / session: 0.5** *(1 session had no answers)* — the patient opened the game twice but only played once
- **Accuracy: 100%** *(based on 1 of 2)* — only the session with actual gameplay is included in the accuracy average

This prevents misleading statistics and gives caregivers honest context about the data.

### 8.4 Data Flow

```
Patient App                    Backend                        Caregiver Dashboard
─────────────                  ───────                        ───────────────────
MathGame.jsx ──POST /api/games──▶ GameSession model           Activity.jsx
MemoryGame.jsx─────────────────▶ (gameType, score,           ├─ Bar chart: sessions by type
                                   duration, accuracy,        ├─ Performance chart: per-type
                                   playedAt)                  │  trend with Math/Memory toggle
                                                              └─ Click callout: detailed
                                GET /api/activity/               breakdown per data point
                                  games-summary ─────────────▶
                                  (returns seriesByDay with
                                   perfByType per day)
```

### 8.5 Backend Aggregation (`getGamesSummary`)

The `GET /api/activity/games-summary` endpoint accepts `from`, `to`, and `patientId` query parameters and returns:

- **`seriesByDay`** — one entry per day with:
  - Total session counts and per-game-type counts (`memory`, `math`, `sequencing`)
  - Combined averages (`avgScore`, `avgAccuracy`, `sessionsWithAccuracy`)
  - **`perfByType`** — per-game-type breakdown, each containing `count`, `avgScore`, `avgAccuracy`, and `sessionsWithAccuracy`
- **`totals`** — same structure aggregated over the full date range

The per-type breakdown (`perfByType`) enables the frontend to show accurate, game-specific performance trends at all zoom levels (day, week, month, 6-month, year).

### 8.6 Frontend Bucketing

For the "6 Month" and "Year" period views, daily data points are aggregated into weekly or monthly buckets. The `perfByType` data is carried through this bucketing process so the game-type toggle produces correct averages even at coarse granularities. Weighted averaging is used: each day's average is weighted by its session count to avoid distortion from days with few sessions.
