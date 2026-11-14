from datetime import date, time

from app.planner import AvailabilityBlock, PlanningRequest, RiskLevel, Task, generate_plan


def test_prioritizes_nearest_deadline_and_respects_available_time() -> None:
    request = PlanningRequest(
        tasks=[
            Task(
                id="later",
                title="Later reading",
                course="CSE 102",
                due_date=date(2026, 11, 20),
                estimated_minutes=90,
            ),
            Task(
                id="soon",
                title="Lab 4",
                course="CSE 101",
                due_date=date(2026, 11, 15),
                estimated_minutes=60,
            ),
        ],
        availability=[
            AvailabilityBlock(date=date(2026, 11, 14), start_time=time(18), end_time=time(20))
        ],
    )

    plan = generate_plan(request, today=date(2026, 11, 14))

    assert plan.sessions[0].task_id == "soon"
    assert plan.scheduled_minutes == 110
    assert plan.risk is RiskLevel.MEDIUM
    assert plan.unscheduled[0].task_id == "later"


def test_reports_high_risk_when_due_work_cannot_fit() -> None:
    request = PlanningRequest(
        tasks=[
            Task(
                id="lab",
                title="Lab",
                course="CSE 101",
                due_date=date(2026, 11, 14),
                estimated_minutes=120,
            )
        ],
        availability=[
            AvailabilityBlock(date=date(2026, 11, 14), start_time=time(18), end_time=time(19))
        ],
    )

    plan = generate_plan(request, today=date(2026, 11, 14))

    assert plan.risk is RiskLevel.HIGH
    assert plan.unscheduled[0].remaining_minutes == 60
