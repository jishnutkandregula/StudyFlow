# StudyFlow Product Spec

## Working name

StudyFlow is a working name. We will choose a distinct public product name before launch.

## The problem

UCSC students manage coursework across Canvas, Google Calendar, Gmail, syllabi, class schedules, work shifts, meetings, meals, and personal commitments.

The biggest failure is not simply forgetting a deadline. Students often realize an assignment is due too late, discover they have fallen behind, and do not know what work to prioritize or whether there is still enough time to recover.

## The product

StudyFlow is an adaptive academic planning assistant that helps students turn coursework, deadlines, availability, and personal constraints into a realistic study plan. The first release uses manual entry; Google Calendar and Canvas make later releases more convenient.

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

1. The student enters preferences such as sleep hours, meal times, maximum study-session length, and preferred work times.
2. The student adds courses, coursework, due dates, estimates, and available study time manually.
3. StudyFlow creates suggested study blocks based on deadlines, assignment weight, estimated effort, and availability.
4. The student approves, edits, rejects, or locks suggested study blocks inside StudyFlow.
5. If the student misses work, StudyFlow recalculates the plan and explains the trade-offs.

## MVP features

- User-defined sleep, breakfast, lunch, dinner, and personal-time preferences
- Courses, assignments, due dates, estimated effort, and grading weights
- Study-window detection
- Weekly study-plan generation
- Clear risk alerts for workloads that do not fit available time
- Missed-work recovery planning

## Not in version one

- Scraping Canvas Dashboard
- Reading all Gmail emails
- Google Calendar integration or calendar writes
- Canvas, syllabus, or coursework imports
- Completing coursework for a student
- Flashcards, tutoring, or essay generation
- Social features
- Native mobile app
- Automatic changes to a calendar without approval

## Integration strategy

The manual planning workflow comes first so StudyFlow can prove that its schedules and recovery plans are useful without requiring account permissions.

Google Calendar read access is the first integration after the MVP because students already use it to track classes, meetings, work, and personal commitments. Calendar writes remain opt-in and require approval.

Canvas is important, but we should start with a safe import method such as a Canvas calendar feed, assignment export, or user-reviewed syllabus import. We should not depend on scraping Canvas.

UCSC Gmail can become useful later for opt-in Canvas announcement or deadline detection, but it is not needed for the first version.

## What makes StudyFlow different

Most planners show deadlines.

StudyFlow identifies real study time, protects personal time, creates an achievable plan, and gives an honest recovery plan when the original plan fails.

## Success criteria

A student should be able to:

1. Create a first plan in under five minutes without connecting an external account.
2. Understand why every suggested study block exists.
3. See early when there is not enough time before a deadline.
4. Recover from missed work without rebuilding the entire week manually.
