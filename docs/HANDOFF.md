# StudyFlow — Handoff

Read this first. It is everything a new engineer (human or AI) needs to keep building StudyFlow
without re-learning what is already decided. Code is the source of truth; this file explains the
*why*, the rules that must not break, and what is unfinished.

Last updated: 2026-11-19 · `main` at the commit that adds this file.

---

## 1. What StudyFlow is

A study planner for college students. It pulls assignments from **Canvas**, estimates how long each
will really take (and says why), reads **Google Calendar** busy time, and places focused study
sessions before each deadline. When the week changes, it replans and shows what moved.

- **Web:** https://study-flow-psi-two.vercel.app (landing at `/`, planner at `/app`, `/privacy`)
- **API:** https://studyflow-api-yaq3.onrender.com (`/docs` for OpenAPI)
- **Repo:** https://github.com/jishnutkandregula/StudyFlow (branch `main`)

The owner is building this as a portfolio piece for AI product engineering roles. Quality,
explainability and a polished UI matter as much as features.

## 2. Repository map

```
apps/api/                FastAPI + Pydantic v2 (Python 3.9 locally, 3.12 in CI/Render)
  app/main.py            app, middleware, router registration
  app/planner.py         deterministic scheduler (sessions, health, reasons)
  app/estimator.py       time estimates: rules + learned pace (no LLM)
  app/estimates_routes.py POST /api/v1/estimates
  app/canvas_feed.py     Canvas calendar-feed (.ics) fetch + parser
  app/canvas_client.py   Canvas REST (personal token) client
  app/canvas_routes.py   /api/v1/canvas/* (connect, connect-feed, courses, sync)
  app/workspace.py       saved workspace model + /api/v1/workspace
  app/session.py         anonymous httpOnly session cookie
  app/crypto.py          Fernet encryption of Canvas credentials
  app/storage.py         SQLite (local) / Postgres (prod)
  app/ratelimit.py       in-memory rate limits
  tests/                 pytest (115 tests); run against SQLite and Postgres in CI
apps/web/                Next.js 15 App Router, React 19, TypeScript, no UI library
  app/page.tsx           landing page (server component, no API calls)
  app/app/page.tsx       the planner (client; owns all workspace state)
  app/privacy/page.tsx   privacy page
  app/layout.tsx         fonts (next/font), theme bootstrap script
  app/styles.css         the whole design system (tokens + components), one file
  components/            UI pieces; canvas/ (connect + review), landing/ (demo, reveal)
  lib/                   API clients, types, formatting, busy-time helpers, sample data
docs/                    product, architecture, deployment, roadmap docs
render.yaml              Render blueprint for the API
.github/workflows/ci.yml lint + tests (API on 3.9 and 3.12, SQLite + Postgres) + web typecheck/build
```

## 3. Run it locally

```bash
# API
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000

# Web (separate terminal)
cd apps/web && npm install && cp .env.example .env.local
STUDYFLOW_API_ORIGIN=http://localhost:8000 npm run dev -- --port 3000
```

Open http://localhost:3000 (landing) or http://localhost:3000/app (planner).
`/app?sample=1` loads a labelled sample week into an empty workspace.

**Checks that must pass before any commit** (CI runs the same):

```bash
cd apps/api && .venv/bin/ruff check app tests && .venv/bin/python -m pytest -q
cd apps/web && npx tsc --noEmit && npx next build
```

Gotchas:
- `next build` writes to `.next`, the same folder `next dev` uses. Stop the dev server first, or it
  will serve unstyled pages until restarted with `.next` deleted.
- Python must stay 3.9-compatible: use `Optional[...]` with `# noqa: UP045` and
  `from __future__ import annotations`. Ruff targets py39, line length 100.

## 4. Environment and accounts (names only, never values)

| Where | Variable | Purpose |
| --- | --- | --- |
| Render (API) | `STUDYFLOW_SECRET_KEY` | Fernet key for Canvas credentials. Rotating it disconnects every Canvas link. |
| Render | `DATABASE_URL` | Neon Postgres (Oregon) |
| Render | `STUDYFLOW_ALLOWED_ORIGINS` | the Vercel origin |
| Render | `STUDYFLOW_ENV=production`, `PYTHON_VERSION` | set in `render.yaml` |
| Local only | `STUDYFLOW_DB_PATH`, `STUDYFLOW_COOKIE_SECURE` | SQLite path, cookie flag for http |
| Vercel (web) | `STUDYFLOW_API_ORIGIN` | where Next.js proxies `/api/*` (server-side) |
| Vercel | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth web client (public identifier) |

Google Cloud OAuth app is in **testing** mode: only listed test users can connect Calendar.
Authorized JavaScript origins include the Vercel URL and `http://localhost:3000`.

Deploys: Vercel deploys `main` automatically. Render deploys `main` **only after CI passes**
(`autoDeployTrigger: checksPass`). Render free tier sleeps; the first request can take ~50 s.

**Secrets never go in the repo, in chat, or in a tool's prompt.** The owner enters them in the
Render / Vercel / Neon / Google dashboards.

## 5. Architecture decisions (and why)

1. **Same-origin API.** The browser only talks to the Next.js origin; `next.config.ts` rewrites
   `/api/*` to FastAPI. That keeps the session cookie `SameSite=Lax` + `httpOnly` with no CORS
   cookie setup. All mutating requests must send header `X-StudyFlow-Request: 1` (CSRF guard).
2. **No accounts yet.** An anonymous session cookie (`sf_session`) identifies a browser; the server
   stores only its SHA-256 hash. One browser = one workspace. "Delete my data" wipes it.
3. **Workspace is one JSON document** (`apps/api/app/workspace.py`, mirrored in
   `apps/web/lib/workspaceApi.ts`). The client autosaves the whole thing (debounced PUT).
   Adding a field = add it to the Pydantic model, the DTO, load and save mapping, and a round-trip
   test. Unknown fields are ignored by the server, so old clients keep working.
4. **Canvas has two connection methods.**
   - *Calendar feed (default):* the student pastes `https://<host>/feeds/calendars/user_<id>.ics`.
     Validated (HTTPS, SSRF guard, strict path regex), fetched without redirects, capped at 5 MB,
     parsed by a small custom iCalendar parser. Stored encrypted as `"feed:" + url` in the same
     column as tokens (no migration needed).
   - *Personal access token:* optional; adds points and submission status. Many schools grey out
     token creation, which is why the feed is the default.
   Class meetings from the feed become busy time (no titles kept).
5. **Estimates are deterministic, not an LLM** (`app/estimator.py`). The owner chose
   "rules + learning only". Two stages:
   - *Rules:* classify the work (exam, quiz, discussion, presentation, lab, programming, project,
     essay, problem_set, reading, reflection, other) from the title, then the description; read
     stated amounts (word counts, pages, problems, chapters, slides, time limits); otherwise use a
     typical length nudged by points.
   - *Learning:* each finished task stores (category, course, first estimate, logged minutes).
     A log-ratio multiplier with hierarchical shrinkage (same course+kind → kind elsewhere → all
     work; priors 3 / 4 / 12; ratios clamped to [1/3, 3]; multiplier to [0.5, 2.5]) adjusts future
     estimates. One fast lab moves the next lab in that course by about 24%, not 50%.
   - Every estimate carries a human-readable `reason`, shown in the UI. Keep that property.
6. **Busy time is tagged by source** (`google` | `canvas`). A re-sync replaces only that source.
   Overnight events are split per day; duplicates are removed; Google events marked Free,
   declined, cancelled or "working location" are ignored.
7. **The planner is deterministic and explainable.** Each session has a "Why?"; the plan has a
   four-level health (on track, tight, at risk, not recoverable) with a reason; every replanning
   action shows what moved and can be undone.

## 6. Design system (web)

- All colors are tokens in `app/styles.css` (`--bg`, `--surface`, `--text`, `--text-2`,
  `--accent`, `--accent-rgb`, `--good-rgb`, … and `rgb(var(--ink-rgb) / a)` for translucent ink).
  **Never hard-code a color**; light mode will break.
- Themes: dark is the default and no-JS fallback; `data-theme="light"` on `<html>` switches.
  `layout.tsx` runs a tiny inline script before paint (saved choice in `localStorage['sf-theme']`,
  else the system setting) and adds the `js` class. The toggle uses the View Transitions API.
- The "next move" hero card is deliberately dark in both themes (its tokens are re-declared on it).
- Type: Geist (UI), Geist Mono (labels), Instrument Serif italic for gradient accents, via
  `next/font` (self-hosted, no request to Google from the browser).
- Style direction from the owner: **mostly bold/expressive** (big tight type, saturated
  violet→magenta→orange gradient, launch-page energy) **with an airy editorial feel**, and
  "nice movements" everywhere.
- Motion rules: ease-out / spring curves are tokens (`--ease-out`, `--ease-spring`). Everything
  respects `prefers-reduced-motion`. Scroll reveals use IntersectionObserver (`RevealOnScroll`),
  hidden only under `html.js` so no-JS users see content. Do not use scroll-driven CSS animations
  for reveals; they left content half-transparent at the bottom of the page.
- Must work at 375 px with no horizontal scroll.

## 7. Rules that must not break

- Calendar **event titles never leave the browser**; only times are saved (the save mapping
  replaces labels). Assignment descriptions are read to estimate, then discarded.
- Canvas and Google access are **read-only**. StudyFlow never writes to either.
- Canvas credentials are **encrypted at rest**; never returned to the browser.
- The landing page makes **no API calls** (visiting it must not create a session).
- Sample data is always labelled (`source: "sample"`) and removed before real coursework is added.
- Any claim on the landing or privacy page must be true of the code.
- Keep `docs/` and `README.md` in sync with behavior, including `/privacy` when data use changes.

## 8. How the owner likes to work

- For each phase: state the problem, scope, risks and acceptance criteria; get approval for large
  phases; implement in focused commits; verify in a real browser (both themes, phone width);
  report honestly what was and wasn't tested.
- Commit messages: conventional style (`feat(web): …`), body explains why.
- **Push only when the owner asks.**
- Never paste or request secrets; the owner does all account and dashboard setup.
- Plain-English explanations; the owner is a student, not a Canvas/OAuth expert.

## 9. Status

Done and live (2026-11-19):

| Phase | What |
| --- | --- |
| MVP + A–D | planner, replanning, persistence, deployment (Vercel + Render + Neon) |
| E1 | Canvas in one paste (calendar feed) |
| — | explainable estimates that learn your pace; Canvas + Google busy time work together |
| E2 | design system: tokens, light/dark toggle, new type, motion |
| E3 | landing page with a self-playing product demo; planner moved to `/app` |
| E4 | first-run setup (rhythm → Canvas → Calendar → first plan), saved as `onboarded_at` |

Not yet verified by hand:
- A real UCSC Canvas feed end to end (only tested with a fixture feed).
- Google Calendar on the live site with a test-user account (since the latest changes).
- A real phone (only browser emulation at 375 px).

Deferred / ideas:
- **E5 — AI layer (Claude):** on hold by the owner's choice. Candidates: natural-language
  "I'm sick Thursday" replanning, reading an assignment PDF for scope, weekly review summaries.
  If added, keep the deterministic estimator as the baseline and show reasons.
- Accounts across devices (today one browser = one workspace).
- Writing study blocks back to Google Calendar (would need a write scope; currently read-only).
- Planner warning when an estimate is low-confidence.
- Uptime monitor, README screenshots, paid Render instance before sharing widely.
- Google OAuth app verification (needs a verified domain; `*.vercel.app` can't be verified).

## 10. Where to look next

- `README.md` — setup, Canvas instructions, how estimates work, calendars together
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/INTEGRATIONS.md`
- `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/USER_FLOWS.md`
- `git log` — each commit body explains a phase in detail
