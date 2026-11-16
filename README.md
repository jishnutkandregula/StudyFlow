# StudyFlow

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

The manual planning MVP is in active development. The first vertical slice includes a responsive
Next.js interface and a tested FastAPI planning service. It supports manual coursework entry,
deadline-first session generation, recurring editable availability, sleep and meal guardrails,
protected commitments, daily study caps, and workload-risk reporting. Data persistence,
coursework editing, onboarding, and true recovery recalculation are the next build steps.

The initial focus remains a manual planning MVP:

1. Add courses and assignments.
2. Define available study time and protected personal time.
3. Generate an explainable weekly study plan.
4. Identify workload risk.
5. Re-plan after missed work.

## Run locally

Start the API in one terminal:

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/python -m pip install "fastapi>=0.115" "uvicorn[standard]>=0.32"
.venv/bin/uvicorn app.main:app --reload
```

Then start the web app in another:

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`. The web app calls the API at `http://127.0.0.1:8000` by default.

## Development checks

```bash
cd apps/api && .venv/bin/python -m pytest tests -q && .venv/bin/python -m ruff check app tests
cd apps/web && npm run typecheck && npm run build
```

## Documentation

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
