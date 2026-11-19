# StudyFlow

[![CI](https://github.com/jishnutkandregula/StudyFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/jishnutkandregula/StudyFlow/actions/workflows/ci.yml)

> Adaptive academic planning for students who need to know what to do next—and how to recover when they fall behind.

StudyFlow helps college students turn coursework, deadlines, and real calendar availability into realistic study plans.

Most academic planners show what is due. StudyFlow focuses on when students can actually complete the work, which assignments are at risk, and what to change when the original plan no longer works.

## The problem

Students often manage coursework across Canvas, syllabi, Google Calendar, email, work shifts, meetings, personal commitments, meals, and sleep.

Knowing that an assignment is due is not the same as having a realistic plan to complete it.

StudyFlow is designed to help students:

- Identify real study time around existing commitments
- Prioritize assignments by deadline, effort, and importance
- Break work into focused study sessions
- Detect workload risk before a deadline becomes an emergency
- Rebuild a plan after missed or incomplete work
- Keep control over calendar and integration decisions

## Planned experience

```text
Coursework + deadlines
        +
Google Calendar availability
        +
Student preferences
        ↓
Realistic study plan
        ↓
Risk alerts and recovery planning
        ↓
Student-approved calendar updates
```

## Core principles

- **Realistic:** Meals, sleep, work, commute, meetings, and personal time matter.
- **Student-controlled:** StudyFlow suggests plans; students approve calendar changes.
- **Honest:** It flags insufficient capacity instead of creating impossible schedules.
- **Private:** External accounts require explicit permission and can be disconnected.
- **Adaptive:** Plans change when assignments, estimates, or availability change.
- **School-agnostic:** The first persona is a UCSC student, but the product is intended for college students broadly.

## Planned technology

- React, Next.js, and TypeScript
- Python and FastAPI
- PostgreSQL
- Scheduling and optimization algorithms
- Google Calendar integration
- Docker, automated testing, CI/CD, and cloud deployment

## Project status

Working MVP. A student can:

1. Connect **Canvas** with a personal access token, choose courses, and review every upcoming
   assignment (include or exclude it, adjust estimates, date the undated ones) before it reaches
   the plan.
2. Connect **Google Calendar** read-only, so classes, shifts, and meetings become protected
   busy time.
3. Set availability, sleep, meals, recurring commitments, focus length, and a daily cap.
4. Generate an explainable plan: sessions grouped by day, a "Why?" for each, and a four-level
   schedule health (on track, tight, at risk, not recoverable) with a reason.
5. Replan as life happens: mark a session done, add 30 minutes, lock a session in place, or take
   today off. Every change shows what moved, and every change can be undone.
6. Come back later: the workspace autosaves, and Canvas re-syncs in one click.

Next: accounts across devices, deployment, and optional study blocks written to Google Calendar.
See the [product vision](docs/PRODUCT_VISION.md) for the full gap analysis.

## Run locally

Start the API in one terminal:

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/python -m pip install -U pip
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload
```

Then start the web app in another:

```bash
cd apps/web
cp .env.example .env.local   # then fill in values as needed
npm install
npm run dev
```

Open `http://localhost:3000`. Next.js proxies `/api/*` to the API at `http://127.0.0.1:8000`
(override with `STUDYFLOW_API_ORIGIN`), so the browser only ever talks to one origin.

### API configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `STUDYFLOW_ENV` | `development` | Set `production` to require a real secret key and secure cookies |
| `STUDYFLOW_SECRET_KEY` | dev key file | Fernet key that encrypts stored Canvas tokens. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `DATABASE_URL` | unset | Postgres connection string; when set, it replaces SQLite (required in production) |
| `STUDYFLOW_DB_PATH` | `apps/api/studyflow.db` | SQLite database location for local development |
| `STUDYFLOW_COOKIE_SECURE` | `true` in production | Send the session cookie over HTTPS only |
| `STUDYFLOW_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | CORS origins |

In development, a key is generated once into `apps/api/.studyflow-dev-key` (owner-only
permissions, gitignored) so saved Canvas connections survive API reloads.

## Data and privacy

- **Sessions:** StudyFlow has no accounts yet. Each browser gets an anonymous session in an
  `HttpOnly`, `SameSite=Lax` cookie, and the server stores only a hash of its id. Writes also
  require a custom header, which blocks cross-site request forgery.
- **What's saved:** coursework, settings, the current plan, and Google Calendar busy *times*.
  Calendar event titles never leave the browser.
- **Canvas token:** sent once, encrypted at rest, never logged, never returned to the browser.
  If Canvas rejects it later, StudyFlow deletes it and asks you to reconnect.
- **Deleting:** Preferences → *Your data* → *Delete my StudyFlow data* erases the session
  and the Canvas connection. *Disconnect Canvas* removes just the token.

## Canvas setup

StudyFlow imports your upcoming assignments from Canvas LMS in one of two ways. Click
**Connect Canvas** and follow the guided steps.

### Option A: Calendar feed (default, works at every school)

Many schools block personal access tokens for students. Every Canvas user can still copy their
private calendar feed, which lists each assignment's due date and course.

1. Type your school's Canvas address (for example `canvas.ucsc.edu`) and click **Open**. StudyFlow
   opens your Canvas calendar in a new tab.
2. Click **Calendar Feed** at the bottom right of the calendar and copy the link. It looks like
   `https://canvas.yourschool.edu/feeds/calendars/user_….ics`.
3. Back in StudyFlow, click **Paste link** (or paste into the box). StudyFlow connects as soon as it
   sees a feed link.

The feed has no point values or submission status, so you set estimates during review and mark work
done in StudyFlow. The link is private, so StudyFlow treats it like a password: it's validated
(HTTPS, a public host, and the exact `/feeds/calendars/user_….ics` path), stored encrypted, never
logged or returned to the browser, and deleted when you disconnect. If you reset the feed in
Canvas, StudyFlow forgets the old link and asks you to reconnect.

### Option B: Personal access token (adds points and submission status)

If your school allows tokens, choose **Connect with a token** in the Canvas window.

#### 1. Find your Canvas URL

Use the address you see in the browser when you're logged in to Canvas — for example
`canvas.ucsc.edu` or `https://yourschool.instructure.com`.

- `https://` is optional: a bare hostname gets it added, and `http://` is upgraded to HTTPS.
- Any path (such as `/courses/123`) is ignored; only the host is used.
- `localhost`, IP addresses, and hostnames without a domain are rejected.

#### 2. Generate a personal access token

1. In Canvas, open **Account → Settings** (left-hand global navigation).
2. Scroll to **Approved Integrations** and click **+ New Access Token**.
3. Enter a purpose (e.g. "StudyFlow") and, ideally, an expiration date.
4. Click **Generate Token** and copy it immediately — Canvas shows it only once.
5. Paste it into the StudyFlow token field.

If the **New Access Token** button is greyed out or missing, your school has disabled personal
tokens. Use the calendar feed (Option A) instead.

### Review before importing

After choosing courses, StudyFlow lists every upcoming assignment with its due date, points (token
connections), and a time estimate with the reason behind it (see [How estimates work](#how-estimates-work)). Untick anything you don't want planned, adjust estimates, and
pick dates for assignments Canvas has no due date for. Syncing again keeps the estimates you set.

### Token permissions

A personal access token acts as your Canvas user, so it can see whatever your student account
can see. StudyFlow only makes read-only `GET` requests:

| Endpoint | Used for |
| --- | --- |
| `/api/v1/users/self` | Verify the token and show your name |
| `/api/v1/courses` | List your active student enrollments |
| `/api/v1/courses/:id/assignments` | Fetch upcoming assignments for selected courses |

No special scopes or admin rights are needed — a normal student account works. If your school
enforces scoped developer keys, the token needs read access to the three endpoints above.

The token is sent to the StudyFlow API once, stored encrypted so later syncs need no token, and
never logged or sent back to the browser. **Disconnect Canvas** deletes it immediately, and you
can also revoke it in Canvas under **Account → Settings → Approved Integrations**.

## How estimates work

Every assignment gets an estimate and a one-line reason, such as *"Writing assignment · ~1,500 words"*
or *"Lab · typical lab · −24% for your pace on CSE 101 labs (1 finished)"*. The estimator
([`apps/api/app/estimator.py`](apps/api/app/estimator.py)) is deterministic and has two stages:

1. **Rules read the assignment.** The title (then the Canvas description) decides the kind of work:
   essay, problem set, reading, lab, quiz, exam prep, project, presentation, discussion post. The
   amount stated beats the kind: word counts ("1,200–1,500 words", "a 1,500-word essay"), pages of
   writing vs. pages of reading, problem ranges ("problems 1–12"), chapters, slides, and quiz time
   limits. With nothing stated, the kind's typical length is used, gently scaled by points.
2. **Calibration learns your pace.** Finishing a task records StudyFlow's first estimate and the
   focus time you logged ("Done" on sessions, "+30", or "Finished it" early). Future estimates are
   multiplied by your actual-to-estimated ratio, averaged in log space and shrunk toward "no change"
   across three levels: this kind of work in this course, this kind of work anywhere, and all work.
   Each finished task counts once, at its most specific level, so one odd week can't swing everything.

You can always change an estimate; the reason shows that you did.

## Calendars working together

Study sessions never land on time that's already taken:

- **Google Calendar:** timed events, except ones marked *Free*, invitations you declined, and
  working-location markers. Events that cross midnight are split across both days.
- **Canvas:** with the calendar feed, class meetings and other timed Canvas events become busy time.
- The same event arriving from both sources is counted once, and re-syncing one source replaces
  only that source's busy time.

## Development checks

```bash
cd apps/api && .venv/bin/python -m pytest tests -q && .venv/bin/python -m ruff check app tests
cd apps/web && npm run typecheck && npm run build
```

## Documentation

- [Product vision and roadmap](docs/PRODUCT_VISION.md) — source of truth
- [Deployment plan](docs/DEPLOYMENT.md)
- [Product specification](docs/PRODUCT.md)
- [User flows](docs/USER_FLOWS.md)
- [Target market](docs/TARGET_MARKET.md)
- [Integration strategy](docs/INTEGRATIONS.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Product roadmap](docs/ROADMAP.md)

## Working name

“StudyFlow” is currently the repository and working name. A distinct public product name will be selected before launch.

## License

This project is available under the terms of the [MIT License](LICENSE).
