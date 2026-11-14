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

StudyFlow is currently in the product-planning phase.

The initial focus is a manual planning MVP:

1. Add courses and assignments.
2. Define available study time and protected personal time.
3. Generate an explainable weekly study plan.
4. Identify workload risk.
5. Re-plan after missed work.

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
