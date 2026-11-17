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
| `STUDYFLOW_DB_PATH` | `apps/api/studyflow.db` | SQLite database location |
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

StudyFlow can import your active courses and upcoming assignments from Canvas LMS using a
personal access token. Click **Canvas LMS** in the Connections section and follow the two steps.

### 1. Find your Canvas URL

Use the address you see in the browser when you're logged in to Canvas — for example
`canvas.ucsc.edu` or `https://yourschool.instructure.com`.

- `https://` is optional: a bare hostname gets it added, and `http://` is upgraded to HTTPS.
- Any path (such as `/courses/123`) is ignored; only the host is used.
- `localhost`, IP addresses, and hostnames without a domain are rejected.

### 2. Generate a personal access token

1. In Canvas, open **Account → Settings** (left-hand global navigation).
2. Scroll to **Approved Integrations** and click **+ New Access Token**.
3. Enter a purpose (e.g. "StudyFlow") and, ideally, an expiration date.
4. Click **Generate Token** and copy it immediately — Canvas shows it only once.
5. Paste it into the StudyFlow token field.

If the **New Access Token** button is missing, your school has disabled personal tokens; ask your
Canvas administrator or use Google Calendar instead.

### 3. Review before importing

After choosing courses, StudyFlow lists every upcoming assignment with its due date, points, and a
starting time estimate based on points. Untick anything you don't want planned, adjust estimates, and
pick dates for assignments Canvas has no due date for. Syncing again keeps the estimates you set.

### Permissions

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
