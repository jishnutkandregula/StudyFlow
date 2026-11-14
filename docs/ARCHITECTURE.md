# Technical Architecture

## Purpose

StudyFlow should be built as a reliable full-stack application that can safely connect coursework, calendar availability, personal planning preferences, and adaptive scheduling.

The architecture should support a small first release while leaving room for more advanced optimization, Canvas support, notifications, and broader student use.

## High-level system

```text
Student
   |
   v
React / Next.js web application
   |
   v
Python / FastAPI backend
   |
   +--> PostgreSQL database
   |
   +--> Scheduling engine
   |
   +--> Google Calendar integration
   |
   +--> Background-job worker
   |
   +--> Notification service
```

## Frontend

### Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- Calendar and scheduling interface

### Responsibilities

The frontend allows students to:

- Create an account and connect integrations
- Add courses, assignments, exams, and availability
- View workload and deadline risk
- Review suggested study sessions
- Approve, edit, or reject calendar changes
- Mark work complete, partially complete, or skipped
- View recovery plans after missed work
- Manage preferences, privacy, and connected accounts

## Backend

### Technology

- Python
- FastAPI
- Pydantic for typed request and response validation
- SQLAlchemy and Alembic for database access and migrations

### Responsibilities

The backend manages:

- Authentication and user accounts
- Courses, tasks, deadlines, and effort estimates
- Personal scheduling preferences
- Calendar connection state and permissions
- Scheduling-plan generation
- Recovery-plan generation
- Risk calculation
- Audit logs for integration actions
- API endpoints for the web application

## Database

### Technology

- PostgreSQL

### Initial data models

- User
- ConnectedAccount
- Calendar
- Course
- Assignment
- AvailabilityPreference
- BusyEvent
- StudySession
- StudyPlan
- PlanChange
- CompletionRecord
- RiskAlert
- IntegrationAuditLog

### Example relationships

```text
User
  ├── Courses
  │     └── Assignments
  ├── Connected Accounts
  │     └── Calendars and Busy Events
  ├── Availability Preferences
  └── Study Plans
          └── Study Sessions
```

## Scheduling engine

### Version-one approach

The first scheduling engine should be deterministic and explainable.

It considers:

- Assignment due date
- Estimated remaining effort
- Grade weight or importance
- Student-defined priority
- Calendar busy time
- Available study windows
- Sleep, meal, commute, and protected-time preferences
- Maximum study-session length
- Minimum break length

The output is a set of suggested study sessions with a clear explanation for each recommendation.

### Core scheduling rules

1. Never schedule during a calendar event or protected personal-time block.
2. Never schedule during sleep or meal windows unless the student explicitly allows it.
3. Prioritize work with nearer deadlines.
4. Use grade weight, importance, and remaining effort to break ties.
5. Split work into focused sessions rather than one unrealistic block.
6. Leave reasonable breaks between sessions.
7. Flag insufficient capacity instead of overbooking a student.
8. Recalculate when a task is skipped, delayed, completed, or re-estimated.

### Later optimization

After the baseline planner is tested, add an optimization layer such as Google OR-Tools.

Possible objectives:

- Maximize on-time completion probability
- Prioritize high-weight coursework
- Avoid fragmented schedules
- Respect preferred work times
- Minimize last-minute cramming
- Preserve personal time
- Produce the smallest realistic recovery plan

## Integrations

### Google Calendar

- OAuth-based connection
- Read selected calendars to identify busy time
- Create study sessions only after student approval
- Support disconnecting and deleting imported data

### Canvas

- Manual entry is the first reliable path
- Later support approved Canvas imports, calendar feeds, exports, or APIs
- Require student review before imported coursework enters a plan

### Gmail

- Not part of version one
- Future opt-in support for academic notifications only
- Never use unrelated personal email

## Background jobs

### Technology

- Redis
- Worker queue such as Celery, RQ, or a managed equivalent

### Responsibilities

Background jobs handle work that should not make the app feel slow:

- Calendar synchronization
- Syllabus parsing
- Assignment import
- Plan regeneration
- Reminder scheduling
- Risk-alert generation
- Notification delivery

## Notifications

Later versions can notify students about:

- High-risk deadlines
- A schedule that no longer has enough capacity
- Upcoming planned study sessions
- Newly imported assignments requiring review
- A recovery plan after missed work

Students control notification types and frequency.

## Security and privacy

- Use secure OAuth flows for third-party integrations.
- Encrypt access tokens at rest.
- Never expose tokens in the browser.
- Request the minimum permissions needed.
- Allow users to disconnect integrations and delete data.
- Require approval before writing to Google Calendar.
- Keep integration audit logs.
- Validate all imported tasks before scheduling them.
- Use HTTPS and secure session management in production.

## Deployment

### Development

- Local frontend and backend services
- Local PostgreSQL database
- Local Redis service
- Docker Compose for consistent development environments

### Production

- Frontend hosted on Vercel or AWS
- FastAPI service deployed to AWS container infrastructure
- Managed PostgreSQL database
- Managed Redis or queue service
- Object storage for uploaded syllabi
- Centralized logs, error tracking, metrics, and alerts
- GitHub Actions for tests and deployment checks

## Testing strategy

- Unit tests for scheduling logic and risk calculations
- API integration tests
- Frontend component tests
- End-to-end tests for onboarding, planning, approval, and recovery flows
- Test data covering normal schedules, overloaded weeks, missed work, conflicting deadlines, and blocked personal time
