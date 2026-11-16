# StudyFlow Roadmap

## Guiding principle

Build the smallest version that can genuinely help a student plan academic work around a real calendar and recover after falling behind.

Do not add AI, Canvas, Gmail, notifications, or complex integrations until the core planning experience is useful and trustworthy.

## Milestone 0 — Product foundation

### Goal

Create the planning documents and define exactly what version one must do.

### Deliverables

- Product specification
- User flows
- Target market and primary persona
- Integration strategy
- Technical architecture
- Roadmap
- Root README

### Status

Complete.

## Milestone 1 — Manual planning MVP

### Goal

Allow a student to manually enter coursework and availability, then receive a realistic weekly study plan.

### Features

- User account and basic onboarding
- Courses
- Assignments, quizzes, exams, readings, and projects
- Due dates and times
- Estimated work time
- Grade weight or importance
- Personal availability
- Sleep, meal, and protected-time preferences
- Weekly plan generation
- Suggested focused study sessions
- Clear explanation for each suggested session
- Workload-risk alert when available time is insufficient

### Definition of done

A student can enter a week of coursework and availability, receive a realistic plan, and understand what task they should work on next.

### Current progress

- Manual coursework entry and deadline-first planning are working.
- Students can configure recurring weekly availability, sleep, meals, protected commitments,
  focus-session length, and a daily study cap.
- The planner excludes protected time and visibly warns when work cannot fit.
- Account creation, coursework editing, persistence, and a true recovery recalculation remain.

## Milestone 2 — Adaptive recovery planning

### Goal

Help students recover when real life disrupts the original plan.

### Features

- Mark a study session as complete, partial, or skipped
- Update remaining work estimates
- Automatically recalculate the plan
- Show affected assignments and deadlines
- Provide recovery options
- Explain trade-offs when all work cannot fit
- Allow students to protect or lock selected study sessions

### Definition of done

A student can miss planned work and receive a clear, achievable recovery plan without manually rebuilding the entire week.

## Milestone 3 — Google Calendar integration

### Goal

Use a student’s actual schedule to identify available study time.

### Features

- Google sign-in
- Calendar read access
- Calendar-selection controls
- Busy-time import
- Availability detection
- Student approval flow before calendar writes
- Add approved study sessions to Google Calendar
- Disconnect integration and delete imported data

### Definition of done

A student can connect Google Calendar, receive schedule-aware study recommendations, and approve individual study blocks before they are added to their calendar.

## Milestone 4 — Coursework import

### Goal

Reduce manual academic-work entry while maintaining accuracy and student control.

### Features

- Syllabus upload
- Reviewable assignment extraction
- Deadline, grading-weight, and course-information detection
- Student confirmation and editing before import
- Canvas calendar-feed, export, or approved API investigation

### Definition of done

A student can import coursework, review every extracted item, and confidently add confirmed work to their plan.

## Milestone 5 — Intelligent scheduling

### Goal

Improve planning quality beyond a basic deadline-first schedule.

### Features

- Optimization-based scheduling
- Preferred study-time learning
- Workload distribution across the week
- Better task-duration estimates
- Conflict and overload detection
- Plan-quality evaluation scenarios
- Transparent explanations for scheduling decisions

### Definition of done

StudyFlow produces schedules that are measurably more realistic and useful than the baseline planner.

## Milestone 6 — Notifications and weekly review

### Goal

Help students stay aware before deadlines become emergencies.

### Features

- Upcoming deadline reminders
- High-risk workload alerts
- Missed-session alerts
- Weekly planning review
- Optional email or push notifications
- Notification preference controls

### Definition of done

A student receives useful, low-noise reminders and can choose exactly which
