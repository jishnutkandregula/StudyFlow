# StudyFlow Product Vision

> **Source of truth.** This document records the current product decisions. Where it conflicts
> with older docs (`PRODUCT.md`, `MVP.md`, `ROADMAP.md`), this document wins. Last reviewed
> 2026-11-16.

## What StudyFlow is

StudyFlow is an adaptive academic planning system for college students. It connects to the tools
students already use — **Canvas** and **Google Calendar** — and turns scattered coursework and
real-life commitments into a realistic study plan that keeps up with changes.

It answers six questions:

1. What assignments do I have?
2. What is urgent, important, or at risk?
3. When am I actually free to work?
4. What should I do next?
5. Can I realistically finish everything before the deadline?
6. What changes if a new meeting, shift, or assignment appears?

StudyFlow is not a task list, a calendar clone, or a static dashboard. What sets it apart is that it
turns **real course data plus real calendar constraints into a plan that updates when things
change**.

## Problem

A student's coursework is spread across Canvas, Google Calendar, class schedules, work shifts,
meetings, clubs, meals, sleep, and mental notes. As a result, they find deadlines too late, think
they have more study time than they do, and make plans that fall apart. StudyFlow imports the data
automatically, protects real commitments, and produces a plan the student can trust.

## Target user

A busy undergraduate with several Canvas courses, Google Calendar commitments, workload that varies
week to week, and little free time. The first test user is a UCSC Computer Science student, but
nothing may be UCSC-specific: any Canvas school must work.

These students want guidance **without giving up control**, and a plan that respects human needs,
not just deadlines.

## Decisions that supersede earlier docs

| Topic | Earlier position | Current decision |
| --- | --- | --- |
| Canvas | Excluded from MVP; investigate feeds or syllabus import | **First-class MVP integration** through the official Canvas REST API. Personal access token for now; designed so OAuth can be added later. Never scrape pages. |
| Google Calendar | Excluded from MVP; Milestone 3 | **In the MVP.** Read-only import of busy time. Writing events back is a later, opt-in feature. |
| Default data entry | Manual entry first | **Import first.** Manual entry stays as a fallback. |
| Grades | Unspecified | **Never imported in the MVP.** |
| AI | "AI-assisted estimates" in future versions | Only where it adds concrete, grounded value (see [AI policy](#ai-policy)). No chat box added for buzzwords. |

## MVP experience

1. **Onboarding:** open StudyFlow → connect Google Calendar → connect Canvas → see what data will
   be accessed → set preferences (wake/sleep, meals, preferred hours, daily cap, days off) → review
   imported assignments → generate the first plan.
2. **Google Calendar:** timed events become protected busy time, and recurring events are expanded.
   The student chooses which calendars are read. Only the fields needed for scheduling are kept.
3. **Canvas:** validated, SSRF-safe URL; enrolled courses; upcoming assignments with course, title,
   due date and time, points, and link. Handles pagination, assignments without due dates, expired
   tokens, and missing permissions. The student reviews assignments before they enter the plan.
   Syncs remove duplicates, and the app shows connection status and last sync time.
4. **Planning engine:** ranks work by deadline, effort, priority, course context, and risk.
   Schedules only in realistic free time. Splits large work into sessions and avoids overloading
   any single day. Says plainly when a plan is impossible. Replans when inputs change. Explains every
   decision.
5. **Control:** the student can accept, edit, move, dismiss, or lock any planned session.
6. **Daily dashboard:** what to work on now, today's commitments and sessions, upcoming deadlines,
   at-risk work, free time left this week, sync health, and a clear Replan action.

## Design standard

The look stays dark and premium: strong hierarchy, deliberate typography, generous spacing, and
motion only where it gives feedback or helps orientation. Loading, empty, success, error,
disconnected, and offline states all get proper designs. Contrast, keyboard use, labels, focus
states, and mobile layouts must be accessible. **No fake charts, fake activity, fake metrics, or
decoration without a product purpose.**

## Privacy and security standard

- No secrets in the repository. No logging of authorization headers, tokens, raw event data, or
  private student data.
- Canvas tokens are kept **server-side only**. Credentials are never stored in localStorage or
  frontend code.
- Canvas URLs are validated against SSRF and internal-network access.
- Google access uses the least-privilege scope (`calendar.readonly`).
- The app explains what is imported and why, offers a disconnect action that removes connection
  data, and documents development-mode limitations honestly.

## AI policy

An AI assistant may be added only if it:

- Answers from real imported and planned data (e.g. "What can I finish before Friday?", "Break
  down this vague assignment", "Why is this scheduled now?").
- Cites what its answer is based on and never invents assignments.
- Sits **on top of** the deterministic scheduler and never replaces it.

## Where the code stands today (2026-11-16)

Honest gap analysis against the vision. ✅ done · 🟡 partial · ⬜ not started.

### Integrations

| Capability | Status | Notes |
| --- | --- | --- |
| Google Calendar read-only import | ✅ | Google sign-in popup in the browser, `calendar.readonly`, recurring events expanded (`singleEvents`) |
| Calendar picker / disconnect | ⬜ | Reads every readable calendar, up to 50; no disconnect |
| Canvas URL validation + SSRF guard | ✅ | Tested; bare hostnames accepted |
| Canvas courses + upcoming assignments | ✅ | Pagination; one failing course doesn't stop the sync |
| Canvas error handling (401/403/404/network) | ✅ | Typed error codes |
| Canvas assignment review before import | ⬜ | Courses can be picked, but assignments go straight into the task list |
| Points, due *time*, link carried into the plan | 🟡 | Fetched by the API, then thrown away by the frontend (due date only, fixed 60-minute estimate) |
| Missing-due-date handling | 🟡 | Silently filtered out; never shown to the student |
| Dedup across syncs | 🟡 | By Canvas ID in memory; lost on page refresh |
| Last-sync time / connection health | ⬜ | |
| Token server-side only | ⬜ | Token sits in React state and is sent on every sync (never stored or logged). Needs a server-side session store. |

### Planning and control

| Capability | Status | Notes |
| --- | --- | --- |
| Deadline/weight/priority ranking | ✅ | Deterministic, tested |
| Availability, sleep, meals, protected time, daily cap, busy time | ✅ | |
| Session chunking (focus length + breaks) | ✅ | |
| Per-session explanations | ✅ | |
| Overall risk + unscheduled work warnings | ✅ | low / medium / high |
| Four-level schedule health (on track → not recoverable) | 🟡 | Three levels today, with no explanation of what to change |
| Complete / longer / can't today / lock / move | ⬜ | |
| Replanning with a "what changed" diff | ⬜ | |

### Product and UX

| Capability | Status | Notes |
| --- | --- | --- |
| Premium dark visual language | ✅ | |
| Canvas connect flow with designed states | ✅ | Includes error boundary |
| Persistence across reloads | ⬜ | All state is in memory |
| Onboarding sequence | ⬜ | Connections exist; no guided first run |
| Dashboard data is real | 🟡 | Hard-coded date header, sample tasks, and a hard-coded student identity |
| Accessibility / mobile pass | ⬜ | Not audited |

### Engineering

| Capability | Status | Notes |
| --- | --- | --- |
| Typed FastAPI + Pydantic boundaries | ✅ | |
| Integration clients separate from business logic | ✅ | `canvas_client.py`, `lib/canvasClient.ts`, `lib/googleCalendar.ts` |
| Backend unit + mocked-integration tests | ✅ | 30 tests |
| Frontend component architecture | ⬜ | `page.tsx` is a single ~160-line component with very long lines |
| Frontend tests | ⬜ | |
| Lint + typecheck | 🟡 | Ruff + `tsc`; no ESLint |
| GitHub Actions CI | ✅ | API on Python 3.9 and 3.12, web typecheck and build |
| `.env.example` | ✅ | |
| Deployment + observability plan | ⬜ | |

## The three highest-leverage next tasks

### A. Assignment review + honest planning inputs (recommended)

- **User problem:** Canvas imports go straight into the plan with a fake 60-minute estimate. Points
  and due times are lost, and undated assignments disappear without a word. The student can't trust
  or adjust what the planner is working from, and that breaks the core promise.
- **Scope:** split `page.tsx` into components (needed to build this cleanly). Add an assignment
  review step after the Canvas sync: per-assignment include/exclude, editable estimate with a
  points-based default, due time shown, undated assignments shown separately, link to Canvas.
  Carry `due_at` time and points through to the planner. Show last-sync time. Replace the
  hard-coded header and identity.
- **Risks:** low. Frontend refactor regressions are covered by typecheck and build; the planner API
  contract grows in a backward-compatible way.
- **Why now:** every later feature (health view, replanning, AI explanations) is only as good as
  its inputs, and this is the moment a user decides whether to trust the app.
- **Acceptance:** after a Canvas sync the student sees every upcoming assignment, can exclude any
  and edit its estimate, sees undated items flagged, and the generated plan respects due *times*.
  Typecheck, build, and API tests pass.

### B. Replanning controls

Mark complete / "will take longer" / "can't today" / lock a session, then replan with a visible
"what changed" summary and a four-level schedule health view. This delivers the product's main
difference from other planners. It is best built after A, because it acts on the same inputs and
components.

### C. Persistence + server-side Canvas session

Add a database (SQLite in development, Postgres in production) and a session cookie, so the Canvas
token moves server-side and tasks, preferences, and sync history survive reloads. This is required
before a public deployment, but it is the largest phase and does little for the core loop until A
and B exist.

**Recommendation: A, then B, then C**, each with its own approval, focused commits, and
verification.

## Phase checklist

Before each major phase: (1) the user problem; (2) the scope; (3) security, privacy, and
architecture risks; (4) why now; (5) acceptance criteria. Then implement in focused commits, run
all verification, and report honestly what is complete, mocked, deferred, or blocked.

## Resume claims — earned vs. not yet

Claim only what has been built and verified.

| Bullet | Status |
| --- | --- |
| Full-stack Next.js + Python platform syncing Canvas coursework and Google Calendar availability into constraint-aware plans | 🟡 Both syncs work and feed the planner, but there is no persistence or assignment review yet |
| Secure third-party integrations: OAuth, Canvas API, token handling, validation, pagination, error recovery, least privilege | 🟡 All true except server-side token custody (phase C) |
| Scheduling engine honoring deadlines, recurring availability, calendar events, sleep, meals, protected time, daily caps | ✅ Earned |
| Polished responsive UX with assignment review, sync status, explanations, re-planning controls | ⬜ Needs phases A + B |
| Automated tests, type checking, linting, CI, docs, reproducible setup | ✅ Earned (backend tests + CI); frontend tests would strengthen it |

## Portfolio checklist (eventually)

Live deployment · README screenshots/GIFs · architecture diagram · setup instructions ·
privacy/security notes · engineering case study (problem, insight, architecture, hard decisions,
tradeoffs, real usage) · demo video: connect Canvas → connect Calendar → review assignments →
generate plan → replan after a change.
