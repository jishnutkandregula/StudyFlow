# StudyFlow AI Build Workflow

StudyFlow uses three tools with separate jobs so the project stays coherent instead of becoming a
collection of unreviewed AI-generated changes.

## Codex — implementation owner

- Plans the milestone, edits the repository, runs tests, and keeps the working tree clean.
- Owns API contracts, data models, scheduling behavior, frontend implementation, and verification.
- Nothing is committed until the relevant checks pass.

## Claude — product and architecture reviewer

- Review a short product brief, API contract, or proposed feature before implementation.
- Challenge unclear assumptions, edge cases, privacy implications, and UX tradeoffs.
- Useful prompt: "Review this StudyFlow feature plan. Identify student-safety, scheduling, and
  implementation risks. Do not write code; give a concise decision memo."

## Cursor — focused editor and iteration partner

- Use after a feature has an agreed specification to make small, local edits quickly.
- Ask it to explain unfamiliar code, draft narrowly-scoped tests, or refactor a single component.
- Do not let it redesign data models or bypass the documented API contract without a review.

## Standard loop

1. Define one small outcome and acceptance checks.
2. Ask Claude to review the plan if the decision has product or architecture tradeoffs.
3. Use Codex to implement and verify the coherent slice.
4. Use Cursor for local follow-up edits or UI polish.
5. Re-run the relevant API and web checks before committing.

The source of truth is always this repository, its tests, and the product documents—not any single
chat response.
