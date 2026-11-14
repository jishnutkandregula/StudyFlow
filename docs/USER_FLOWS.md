# StudyFlow User Flows

## 1. First-time setup

1. A student opens StudyFlow.
2. They create an account.
3. The student sets planning preferences:
   - Typical wake and sleep times
   - Breakfast, lunch, and dinner preferences
   - Preferred study days and times
   - Maximum focus-session length
   - Minimum break length
   - Days or times that should never be scheduled
4. The student adds recurring availability and one-time unavailable blocks.
5. StudyFlow shows the student a summary of their available weekly study time.

## 2. Add academic work

### Manual entry

1. The student creates a course.
2. They add an assignment, exam, quiz, reading, or project.
3. They enter:
   - Title
   - Course
   - Due date and time
   - Estimated effort
   - Grade weight or importance
   - Optional notes

### Later import flow

1. The student uploads a syllabus, imports a Canvas calendar feed, or connects an approved Canvas integration.
2. StudyFlow extracts possible assignments, deadlines, course information, and grading weights.
3. The student reviews every extracted item.
4. The student confirms, edits, or rejects each item before it enters their plan.

StudyFlow never silently imports uncertain deadlines.

## 3. Generate a study plan

1. The student selects “Build my plan.”
2. StudyFlow reviews:
   - Upcoming deadlines
   - Assignment importance
   - Estimated work
   - Saved availability and unavailable blocks
   - Meals, sleep, and protected personal time
   - Available study windows
3. StudyFlow creates suggested study sessions.
4. Every session includes:
   - Assignment name
   - Planned duration
   - Deadline
   - Why the session was scheduled at that time
5. The student can accept, move, shorten, delete, or lock a suggested session.

## 4. Google Calendar integration (post-MVP)

1. The student chooses to connect Google Calendar.
2. StudyFlow explains the calendar data it will read and lets the student select calendars.
3. StudyFlow uses busy events to improve available-study-window detection.
4. StudyFlow shows every proposed calendar write before creating a study block.
5. The student can disconnect Google Calendar or disable calendar writes at any time.

## 5. Daily execution

1. The student opens the “Today” view.
2. They see:
   - Their next study session
   - Upcoming deadlines
   - High-risk assignments
   - The most important task to complete next
3. After a session, the student marks work as:
   - Complete
   - Partially complete
   - Skipped
4. The student can update the remaining time estimate.

## 6. Missed-work recovery

1. A student skips or partially completes a planned study session.
2. StudyFlow asks how much work remains.
3. StudyFlow recalculates the plan using remaining availability.
4. It clearly explains the impact:
   - “Your essay is still achievable if you complete two 90-minute sessions before Thursday.”
   - “There is not enough available time to complete all planned work before Friday.”
5. The student chooses a recovery option:
   - Add more study availability
   - Reduce the scope or estimate
   - Deprioritize lower-impact work
   - Move non-academic commitments manually
   - Keep the existing plan

StudyFlow must be honest when a full recovery is not possible.

## 7. Workload-risk alert

1. StudyFlow detects that estimated coursework exceeds available study time before one or more deadlines.
2. It displays a clear risk alert instead of overbooking the student.
3. The student sees the affected tasks and the time shortfall.
4. StudyFlow suggests actionable options, but the student remains in control.

## 8. Privacy and control

For every future integration, students can:

- View what data StudyFlow can access.
- Disconnect Google Calendar.
- Delete imported academic data.
- Prevent StudyFlow from writing to their calendar.
- Use manual planning without connecting external accounts.
