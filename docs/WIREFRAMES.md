# MVP Wireframes

## Purpose

These are low-fidelity screen specifications for the manual-planning MVP. They define hierarchy, content, and decisions before visual design or implementation.

## Navigation

```text
Dashboard · Coursework · Plan · Availability · Settings
```

The dashboard is the default landing screen. A student should never need more than one click to reach the next recommended task, add coursework, or open the weekly plan.

---

## 1. Onboarding and planning preferences

### Goal

Collect the minimum information needed to create a realistic first plan without requiring an external integration.

```text
┌─────────────────────────────────────────────────────────────┐
│ StudyFlow                                       Step 2 of 3  │
│ Plan around your real life, not an ideal week.               │
│                                                             │
│ Typical sleep     [ 12:00 AM ] to [ 8:00 AM ]               │
│ Breakfast         [ 8:00 AM ] to [ 8:30 AM ]                │
│ Lunch             [ 12:30 PM ] to [ 1:15 PM ]               │
│ Dinner            [ 7:00 PM ] to [ 7:45 PM ]                │
│                                                             │
│ Max focus block   [ 90 minutes ▼ ]                          │
│ Min break         [ 15 minutes ▼ ]                          │
│                                                             │
│                [ Back ]     [ Continue ]                    │
└─────────────────────────────────────────────────────────────┘
```

### Required interactions

- Students can skip meal windows and add them later.
- Every default can be edited later in Settings.
- The student sees a short explanation that StudyFlow will not schedule work during protected time.

---

## 2. Coursework entry

### Goal

Make task entry fast enough that manual input is still useful before Canvas import exists.

```text
┌─────────────────────────────────────────────────────────────┐
│ Coursework                                 [ + Add work ]   │
│                                                             │
│ CSE 101                                                         │
│ ├─ Problem Set 3             Due Thu, 11:59 PM   3 hr      │
│ ├─ Midterm review            Due Mon, 9:00 AM    5 hr      │
│                                                             │
│ Writing 2                                                         │
│ ├─ Essay outline             Due Fri, 5:00 PM    2 hr      │
│                                                             │
│ [ + Add course ]                                              │
└─────────────────────────────────────────────────────────────┘

Add-work panel

Course             [ CSE 101                         ▼ ]
Type               [ Assignment                       ▼ ]
Title              [ Problem Set 3                     ]
Due                [ Thu, Nov 20 ] [ 11:59 PM ]
Estimated effort   [ 3 ] hours
Importance         [ High                              ▼ ]

                         [ Cancel ] [ Add to plan ]
```

### Required interactions

- Adding work must take less than one minute.
- A student can edit the estimate or importance later.
- A student can mark an item optional, completed, or remove it.
- Coursework is never added to the schedule automatically; the student selects **Build plan** when ready.

---

## 3. Dashboard: today and workload risk

### Goal

Answer “what should I do next?” immediately, while showing whether the week is realistic.

```text
┌─────────────────────────────────────────────────────────────┐
│ Good evening, Jishnu                         Tue, Nov 18    │
│                                                             │
│ NEXT UP                                                     │
│ Problem Set 3 · CSE 101                                    │
│ 7:30 PM – 9:00 PM · 90 min                                 │
│ Due Thursday at 11:59 PM                                   │
│ [ Start session ] [ Move ] [ Mark unavailable ]            │
│                                                             │
│ WEEKLY LOAD                              [ View full plan ] │
│ 12h planned · 15h estimated · 10h available                │
│ ⚠ 5 hours do not currently fit before Friday.              │
│ [ See recovery options ]                                   │
│                                                             │
│ UPCOMING                                                     │
│ Wed · Essay outline · 2h remaining                          │
│ Thu · Problem Set 3 · 3h remaining                          │
└─────────────────────────────────────────────────────────────┘
```

### Required interactions

- The next action is visually dominant.
- Risk language is direct but non-judgmental.
- The dashboard explains shortfalls in hours, not vague warnings.
- Students can move directly to the recovery flow.

---

## 4. Weekly plan and recovery

### Goal

Show an editable weekly schedule and give a clear path when the original plan fails.

```text
┌─────────────────────────────────────────────────────────────┐
│ Weekly plan                   Nov 17 – Nov 23               │
│ [ < ] [ Today ] [ > ]                     [ Rebuild plan ] │
│                                                             │
│          Mon      Tue       Wed       Thu       Fri          │
│ 9 AM     Class    Class     Class     Class                   │
│ 1 PM               Essay     Review                            │
│ 7 PM     PS 3      PS 3                PS 3                   │
│                                                             │
│ Selected session: Problem Set 3                              │
│ Thu, 7:00 PM – 8:30 PM · 90 minutes                         │
│ Why here: closest available focus block before deadline.     │
│ [ Complete ] [ Partially complete ] [ Skip ] [ Move ]        │
└─────────────────────────────────────────────────────────────┘

Recovery panel after a skipped session

┌─────────────────────────────────────────────────────────────┐
│ Your plan needs 90 more minutes for Problem Set 3.           │
│                                                             │
│ Best recovery option                                         │
│ Add 45 min Wednesday and 45 min Thursday before dinner.     │
│                                                             │
│ Alternative                                                  │
│ Add 90 min Friday morning. This leaves less review time.     │
│                                                             │
│ [ Use best option ] [ Compare options ] [ Keep my plan ]    │
└─────────────────────────────────────────────────────────────┘
```

### Required interactions

- A student can move, lock, skip, or complete a session.
- Rebuilding the plan must never overwrite locked sessions.
- Recovery options state the consequence of each choice.
- If there is no feasible recovery plan, StudyFlow says so clearly and names the affected coursework.

---

## MVP visual direction

- Calm, focused, and academic—not childish or overly gamified.
- Dense enough to show a real week, but never cluttered.
- Use color sparingly: neutral for normal work, amber for risk, red only for impossible or overdue work.
- Prioritize readability, keyboard access, and mobile responsiveness.
- Avoid AI-chat visual language; StudyFlow is a planning tool first.

## Design decisions to preserve

1. Manual availability is the MVP data source.
2. Suggested sessions remain editable by the student.
3. The system explains why it made recommendations.
4. Risk alerts state the actual time shortfall.
5. The recovery experience is a primary feature, not an error state.
