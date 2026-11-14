# StudyFlow MVP Specification

## MVP goal

Help a college student create a realistic weekly study plan from manually entered coursework, personal availability, and protected time.

The MVP must also tell the student when their workload does not fit before a deadline.

## Primary success scenario

A student has several assignments due over the next week, classes and meetings on Google Calendar, limited free time, and a few personal constraints.

They should be able to enter their work and availability, receive a practical plan, understand why the plan was created, and adjust it after missing a session.

## Included in the MVP

### Account and onboarding

- Create an account
- Set time zone
- Set wake and sleep times
- Set breakfast, lunch, and dinner windows
- Set maximum focus-session length
- Set minimum break length
- Set protected times when study sessions should never be suggested

### Coursework management

- Create courses
- Create assignments, quizzes, exams, readings, and projects
- Add a title, course, due date, estimated effort, and importance
- Edit or delete coursework
- Mark work complete, partially complete, or skipped
- Update remaining estimated effort

### Availability management

- Add recurring availability windows
- Add one-time unavailable blocks
- Add personal protected-time blocks
- View available study time for the current week

### Planning engine

- Generate a weekly study plan
- Create focused study sessions instead of one large unrealistic block
- Prioritize nearer deadlines
- Use importance and estimated effort when prioritizing work
- Avoid sleep, meals, unavailable time, and protected time
- Include breaks between study sessions
- Explain why each session is scheduled
- Identify assignments that cannot fit before their deadline

### Recovery planning

- Recalculate the plan after a session is skipped or only partially completed
- Show what changed
- Show which assignments are now at risk
- Offer realistic recovery options
- Never silently change a plan without showing the student

### Dashboard

The dashboard must show:

- The next recommended task
- Today’s planned study sessions
- Upcoming deadlines
- High-risk coursework
- Total available study time
- Total required study time
- A clear workload-risk summary

## Explicitly excluded from the MVP

- Canvas integration
- Syllabus upload
- Gmail integration
- Google Calendar integration
- Automatic calendar writes
- AI chat assistant
- Flashcards or tutoring
- Notifications
- Native mobile app
- Social features
- Advanced optimization
- Paid plans or subscriptions

These can be added only after the manual planning workflow is useful.

## Required screens

1. Sign up and onboarding
2. Dashboard
3. Courses and assignments
4. Availability and preferences
5. Weekly plan
6. Study-session detail
7. Recovery-plan view
8. Settings

## MVP user journey

```text
Create account
    ↓
Set sleep, meals, protected time, and availability
    ↓
Add courses and upcoming coursework
    ↓
Generate weekly plan
    ↓
Review why each study session was suggested
    ↓
Complete, partially complete, or skip a session
    ↓
Receive an updated plan and workload-risk explanation
```

## Acceptance criteria

The MVP is ready for personal use when a student can:

1. Create a weekly plan in under five minutes.
2. Add at least five courses and twenty coursework items.
3. Add availability and protected personal time.
4. Receive study sessions that never overlap blocked time.
5. Receive a clear warning when work cannot fit before a deadline.
6. Mark a session skipped and receive a revised plan.
7. Understand why every study session was scheduled.
8. Use the dashboard without needing external integrations.

## Future versions

After the MVP works reliably:

1. Google Calendar read integration
2. Approved Google Calendar study-block creation
3. Syllabus import
4. Canvas import
5. Notifications
6. AI-assisted estimates and task breakdown
7. Optimization-based scheduling
8. Gmail academic-notification support
