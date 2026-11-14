# StudyFlow Product Spec

## Working name

StudyFlow is a working name. We will choose a distinct public product name before launch.

## The problem

UCSC students manage coursework across Canvas, Google Calendar, Gmail, syllabi, class schedules, work shifts, meetings, meals, and personal commitments.

The biggest failure is not simply forgetting a deadline. Students often realize an assignment is due too late, discover they have fallen behind, and do not know what work to prioritize or whether there is still enough time to recover.

## The product

StudyFlow is an adaptive academic planning assistant that helps students turn Canvas assignments and their real Google Calendar availability into a realistic study plan.

It answers:

- What should I work on next?
- When am I actually free to study?
- How much work can I complete before each deadline?
- What should I deprioritize if I fall behind?
- What is the most realistic recovery plan?

## Primary user

A UCSC student balancing multiple classes, meetings, work, clubs, meals, exercise, and personal commitments.

They use Canvas for assignments, Google Calendar for classes and meetings, and UCSC Gmail for course announcements and communication.

## Core user flow

1. The student connects Google Calendar.
2. StudyFlow reads busy events and identifies available study windows.
3. The student enters preferences such as sleep hours, meal times, maximum study-session length, and preferred work times.
4. The student imports Canvas assignments or adds them manually.
5. StudyFlow creates suggested study blocks based on deadlines, assignment weight, estimated effort, and availability.
6. The student approves, edits, or rejects suggested blocks before anything is added to Google Calendar.
7. If the student misses work, StudyFlow recalculates the plan and explains the trade-offs.

## MVP features

- Google Calendar read integration
- User-defined sleep, breakfast, lunch, dinner, and personal-time preferences
- Courses, assignments, due dates, estimated effort, and grading weights
- Study-window detection
- Weekly study-plan generation
- Clear risk alerts for workloads that do not fit available time
- Missed-work recovery planning
- User approval before creating or changing Google Calendar events

## Not in version one

- Scraping Canvas Dashboard
- Reading all Gmail emails
- Completing coursework for a student
- Flashcards, tutoring, or essay generation
- Social features
- Native mobile app
- Automatic changes to a calendar without approval

## Integration strategy

Google Calendar is the first integration because students already use it to track classes, meetings, work, and personal commitments.

Canvas is important, but we should start with a safe import method such as a Canvas calendar feed, assignment export, or user-reviewed syllabus import. We should not depend on scraping Canvas.

UCSC Gmail can become useful later for opt-in Canvas announcement or deadline detection, but it is not needed for the first version.

## What makes StudyFlow different

Most planners show deadlines.

StudyFlow identifies real study time, protects personal time, creates an achievable plan, and gives an honest recovery plan when the original plan fails.

## Success criteria

A student should be able to:

1. Connect their calendar and create a first plan in under five minutes.
2. Understand why every suggested study block exists.
3. See early when there is not enough time before a deadline.
4. Recover from missed work without rebuilding the entire week manually.
