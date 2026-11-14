# Integrations and Data Permissions

## Purpose

StudyFlow becomes useful when it understands a student’s real academic workload and availability.

Integrations must be helpful without being invasive. Students must understand what data StudyFlow accesses, why it accesses it, and what actions require approval.

## Google Calendar

### Version-one purpose

Google Calendar is the first external integration.

StudyFlow uses it to identify busy time such as:

- Classes
- Meetings
- Work shifts
- Appointments
- Events
- Personal commitments

StudyFlow uses this information to suggest realistic study windows.

### Required permission

StudyFlow requests permission to read calendar events.

This allows the product to identify when a student is unavailable. It does not mean the product can silently create, edit, or delete events.

### Calendar writes

StudyFlow may eventually create study blocks in Google Calendar, but only after the student explicitly approves the proposed sessions.

Before writing any event, StudyFlow must show:

- The assignment or task
- Planned date and time
- Duration
- Calendar where the event will be created
- Option to approve, edit, skip, or disable calendar writes

### Student controls

Students can:

- Choose which calendars StudyFlow can read
- Exclude personal or private calendars
- Disconnect Google Calendar at any time
- Use StudyFlow manually without connecting a calendar
- Disable all calendar writes
- Delete imported calendar data

## Canvas

### Product value

Canvas is the primary source of academic work for many students.

It may contain:

- Assignments
- Quizzes
- Exams
- Due dates
- Course names
- Course announcements
- Grading weights
- Class schedules

### Version-one strategy

StudyFlow will not scrape the Canvas Dashboard.

The first version uses manual entry for reliable task creation. Canvas support will be researched and added through secure, reviewable options such as:

- Canvas calendar feeds
- Course calendar exports
- Student-provided files
- Official Canvas API access, if available and appropriate
- Syllabus upload with user review

### Import rules

Canvas-related imports must always be reviewable.

Before an assignment enters a student’s plan, the student can:

- Confirm it
- Edit the title, due date, estimate, or importance
- Reject it
- Mark it as recurring or optional

StudyFlow must never silently create academic tasks from uncertain data.

## UCSC Gmail and other email accounts

### Future purpose

Email may later help identify:

- Canvas notifications
- Professor deadline changes
- Exam reminders
- Class cancellations
- Office-hour or meeting updates

### Privacy-first rule

Gmail is not part of version one.

If email support is added later, it must:

- Require separate, explicit permission
- Be opt-in, never assumed from calendar access
- Limit access to relevant academic notifications where technically possible
- Show students what information was detected
- Require user confirmation before creating or changing tasks
- Allow immediate disconnection and deletion

StudyFlow should never read, summarize, or use unrelated personal email.

## Manual mode

A student must be able to use the core product without connecting Canvas, Google Calendar, or Gmail.

Manual mode includes:

- Creating courses
- Adding tasks and deadlines
- Setting availability
- Building a study plan
- Tracking progress
- Using recovery planning

Integrations improve convenience; they must never be required for the product to provide value.

## Security principles

1. Request the minimum permissions needed for each feature.
2. Keep access tokens encrypted and never expose them to the client.
3. Do not store external content longer than necessary.
4. Allow students to revoke access and delete imported data.
5. Log integration actions for debugging and user transparency.
6. Never create, edit, or delete external calendar events without confirmation.
7. Clearly explain permissions in plain language before requesting them.

## Integration rollout order

1. Manual task and availability entry
2. Google Calendar read access
3. Approved Google
