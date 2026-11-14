# Target Market

## Product vision

StudyFlow is an adaptive academic planning system for college students.

It helps students turn coursework, deadlines, and real calendar availability into achievable study plans. It detects workload risk early and creates recovery plans when students fall behind.

## Target users

StudyFlow is designed for college students who:

- Manage multiple classes and recurring deadlines.
- Use Canvas, Google Calendar, Gmail, or similar academic tools.
- Have work shifts, clubs, meetings, sports, commuting, or personal commitments.
- Know what assignments are due but struggle to plan when to complete them.
- Need an honest recovery plan after missed work.

## Product principles

1. **Student-controlled:** StudyFlow suggests plans; students approve all calendar changes.
2. **School-agnostic:** It should work beyond UCSC and support common student workflows.
3. **Realistic:** Sleep, meals, work, commute, and personal commitments matter.
4. **Honest:** It should identify insufficient capacity instead of creating impossible schedules.
5. **Adaptable:** Students can set their own routines, constraints, preferences, and priorities.
6. **Private:** Integrations require explicit permission, and users can disconnect or delete data.

## Core integrations

### Version one

- Google Calendar for busy-time availability and approved study-block creation.
- Manual entry for courses, assignments, deadlines, estimated work, and importance.

### Future integrations

- Canvas calendar feeds, exports, or approved API access.
- Syllabus upload with reviewable assignment extraction.
- Gmail, only with explicit permission, for surfacing possible course announcements or deadline changes.
- Other learning-management systems and calendar providers.

## Design requirement

Every feature should work for Jishnu’s real UCSC workflow while remaining useful to a student at another university, with different courses, schedule constraints, calendar habits, and planning preferences.
