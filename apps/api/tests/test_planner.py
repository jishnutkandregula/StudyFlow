from datetime import date, datetime, time

from app.planner import (
    AvailabilityBlock,
    BusyTimeBlock,
    LockedSession,
    MealWindow,
    PlanHealth,
    PlanningPreferences,
    PlanningRequest,
    ProtectedTimeBlock,
    RecurringAvailability,
    RiskLevel,
    Task,
    generate_plan,
)


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


def recurring_request(**overrides: object) -> PlanningRequest:
    """A Monday planning fixture with enough work to exercise schedule boundaries."""

    values: dict[str, object] = {
        "tasks": [
            Task(
                id="lab",
                title="Lab 5",
                course="CSE 101",
                due_date=date(2026, 11, 17),
                estimated_minutes=300,
            )
        ],
        "recurring_availability": [
            RecurringAvailability(day_of_week=0, start_time=time(16), end_time=time(21))
        ],
        "preferences": PlanningPreferences(
            sleep_start=time(23),
            wake_time=time(7),
            focus_session_minutes=50,
            short_break_minutes=10,
            max_study_minutes_per_day=300,
        ),
    }
    values.update(overrides)
    return PlanningRequest(**values)


def test_day_off_creates_no_sessions() -> None:
    request = recurring_request(
        recurring_availability=[
            RecurringAvailability(
                day_of_week=0, start_time=time(16), end_time=time(21), is_day_off=True
            )
        ]
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert plan.sessions == []
    assert "No schedulable time" in plan.warnings[0]


def test_protected_time_is_never_scheduled() -> None:
    request = recurring_request(
        protected_time=[
            ProtectedTimeBlock(
                label="Club meeting", days_of_week=[0], start_time=time(17), end_time=time(19)
            )
        ]
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert plan.sessions[0].starts_at.time() == time(16)
    assert all(
        not (session.starts_at.time() < time(19) and session.ends_at.time() > time(17))
        for session in plan.sessions
    )


def test_sleep_and_meals_split_availability() -> None:
    request = recurring_request(
        recurring_availability=[
            RecurringAvailability(day_of_week=0, start_time=time(6), end_time=time(21))
        ],
        preferences=PlanningPreferences(
            sleep_start=time(23),
            wake_time=time(8),
            meals=[MealWindow(start_time=time(12), end_time=time(13))],
            focus_session_minutes=50,
            short_break_minutes=10,
            max_study_minutes_per_day=300,
        ),
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert all(session.starts_at.time() >= time(8) for session in plan.sessions)
    assert all(
        not (session.starts_at.time() < time(13) and session.ends_at.time() > time(12))
        for session in plan.sessions
    )


def test_daily_cap_limits_scheduled_work() -> None:
    request = recurring_request(
        preferences=PlanningPreferences(
            sleep_start=time(23),
            wake_time=time(7),
            focus_session_minutes=50,
            short_break_minutes=10,
            max_study_minutes_per_day=100,
        )
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert plan.scheduled_minutes == 100
    assert plan.available_minutes == 100


def test_imminent_deadline_warns_when_every_window_is_protected() -> None:
    request = recurring_request(
        tasks=[
            Task(
                id="urgent",
                title="Urgent problem set",
                course="CSE 101",
                due_date=date(2026, 11, 16),
                estimated_minutes=50,
            )
        ],
        protected_time=[
            ProtectedTimeBlock(
                label="Work", days_of_week=[0], start_time=time(16), end_time=time(21)
            )
        ],
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert plan.risk is RiskLevel.HIGH
    assert any("Urgent problem set" in warning for warning in plan.warnings)


def test_imported_calendar_event_is_treated_as_busy_time() -> None:
    request = recurring_request(
        busy_time=[
            BusyTimeBlock(
                date=date(2026, 11, 16),
                start_time=time(16),
                end_time=time(19),
                label="Lecture",
            )
        ]
    )

    plan = generate_plan(request, today=date(2026, 11, 16))

    assert all(session.starts_at.time() >= time(19) for session in plan.sessions)


def _evening(day: date) -> AvailabilityBlock:
    return AvailabilityBlock(date=day, start_time=time(18), end_time=time(23))


def test_sessions_end_before_due_time_on_due_date() -> None:
    request = PlanningRequest(
        tasks=[
            Task(
                id="quiz",
                title="Quiz prep",
                course="STAT 131",
                due_date=date(2026, 11, 14),
                due_time=time(19, 0),
                estimated_minutes=120,
            )
        ],
        availability=[_evening(date(2026, 11, 14))],
    )

    plan = generate_plan(request, today=date(2026, 11, 14))

    assert plan.sessions, "expected the hour before the deadline to be used"
    assert all(s.ends_at <= datetime(2026, 11, 14, 19, 0) for s in plan.sessions)
    assert plan.scheduled_minutes == 60
    assert plan.unscheduled[0].remaining_minutes == 60
    assert "due Sat Nov 14 at 7:00 PM" in plan.sessions[0].explanation


def test_earlier_due_time_wins_on_the_same_day() -> None:
    request = PlanningRequest(
        tasks=[
            Task(
                id="night",
                title="Essay",
                course="WRIT 2",
                due_date=date(2026, 11, 15),
                estimated_minutes=60,
                course_weight=50,
            ),
            Task(
                id="morning",
                title="Lab check-off",
                course="CSE 101",
                due_date=date(2026, 11, 15),
                due_time=time(9, 0),
                estimated_minutes=60,
            ),
        ],
        availability=[_evening(date(2026, 11, 14))],
    )

    plan = generate_plan(request, today=date(2026, 11, 14))

    assert plan.sessions[0].task_id == "morning"


def test_planning_start_skips_time_that_already_passed() -> None:
    request = PlanningRequest(
        tasks=[
            Task(
                id="lab",
                title="Lab",
                course="CSE 101",
                due_date=date(2026, 11, 15),
                estimated_minutes=60,
            )
        ],
        availability=[_evening(date(2026, 11, 14))],
        planning_start=datetime(2026, 11, 14, 20, 30),
    )

    plan = generate_plan(request)

    assert plan.sessions[0].starts_at == datetime(2026, 11, 14, 20, 30)
    assert plan.available_minutes == 150


def test_task_without_due_time_is_backward_compatible() -> None:
    task = Task.model_validate(
        {"id": "a", "title": "A", "course": "C", "due_date": "2026-11-15", "estimated_minutes": 30}
    )
    assert task.due_time is None


def _task(task_id: str, due: date, minutes: int, **extra: object) -> Task:
    return Task(id=task_id, title=task_id.title(), course="CSE 101", due_date=due,
                estimated_minutes=minutes, **extra)


def _prefs(**extra: object) -> PlanningPreferences:
    return PlanningPreferences(sleep_start=time(23), wake_time=time(7), **extra)


def test_locked_session_is_kept_and_other_work_plans_around_it() -> None:
    day = date(2026, 11, 14)
    lock = LockedSession(task_id="lab", starts_at=datetime(2026, 11, 14, 19),
                         ends_at=datetime(2026, 11, 14, 20))
    request = PlanningRequest(
        tasks=[_task("lab", date(2026, 11, 16), 60), _task("essay", date(2026, 11, 16), 60)],
        availability=[AvailabilityBlock(date=day, start_time=time(18), end_time=time(21))],
        locked_sessions=[lock],
        minimum_break_minutes=0,
    )

    plan = generate_plan(request, today=day)

    locked = [s for s in plan.sessions if s.locked]
    assert len(locked) == 1 and locked[0].starts_at == lock.starts_at
    others = [s for s in plan.sessions if not s.locked]
    assert others and all(s.task_id == "essay" for s in others)
    assert all(s.ends_at <= lock.starts_at or s.starts_at >= lock.ends_at for s in others)
    assert plan.sessions == sorted(plan.sessions, key=lambda s: s.starts_at)
    assert not plan.unscheduled


def test_blocked_date_gets_no_sessions() -> None:
    today, tomorrow = date(2026, 11, 14), date(2026, 11, 15)
    request = PlanningRequest(
        tasks=[_task("lab", date(2026, 11, 16), 60)],
        availability=[
            AvailabilityBlock(date=today, start_time=time(18), end_time=time(20)),
            AvailabilityBlock(date=tomorrow, start_time=time(18), end_time=time(20)),
        ],
        blocked_dates=[today],
    )

    plan = generate_plan(request, today=today)

    assert plan.sessions and all(s.starts_at.date() == tomorrow for s in plan.sessions)


def test_short_gap_is_used_instead_of_wasted() -> None:
    day = date(2026, 11, 14)
    request = PlanningRequest(
        tasks=[_task("lab", date(2026, 11, 15), 120)],
        recurring_availability=[
            RecurringAvailability(day_of_week=d, start_time=time(19), end_time=time(20, 30))
            for d in range(7)
        ],
        preferences=_prefs(focus_session_minutes=50, short_break_minutes=10),
    )

    plan = generate_plan(request, today=day)

    # 19:00-19:50, break, then a 30-minute flex session in the 19:50-20:30 window.
    first_day = [s for s in plan.sessions if s.starts_at.date() == day]
    assert [s.minutes for s in first_day] == [50, 30]


def test_health_on_track_when_plenty_of_slack() -> None:
    day = date(2026, 11, 14)
    request = PlanningRequest(
        tasks=[_task("lab", date(2026, 11, 14), 30)],
        availability=[AvailabilityBlock(date=day, start_time=time(18), end_time=time(22))],
    )
    plan = generate_plan(request, today=day)
    assert plan.health is PlanHealth.ON_TRACK
    assert "to spare" in plan.health_reason


def test_health_tight_when_most_free_time_is_used() -> None:
    day = date(2026, 11, 14)
    request = PlanningRequest(
        tasks=[_task("lab", date(2026, 11, 14), 110)],
        availability=[AvailabilityBlock(date=day, start_time=time(18), end_time=time(20))],
    )
    plan = generate_plan(request, today=day)
    assert plan.health is PlanHealth.TIGHT


def test_health_at_risk_when_work_competes_but_each_fits_alone() -> None:
    day = date(2026, 11, 14)
    request = PlanningRequest(
        tasks=[_task("a", date(2026, 11, 14), 90), _task("b", date(2026, 11, 14), 90)],
        availability=[AvailabilityBlock(date=day, start_time=time(18), end_time=time(20))],
        minimum_break_minutes=0,
    )
    plan = generate_plan(request, today=day)
    assert plan.health is PlanHealth.AT_RISK
    assert all(item.recoverable for item in plan.unscheduled)


def test_health_not_recoverable_when_task_cannot_fit_alone() -> None:
    day = date(2026, 11, 14)
    request = PlanningRequest(
        tasks=[_task("project", date(2026, 11, 14), 300)],
        availability=[AvailabilityBlock(date=day, start_time=time(18), end_time=time(20))],
    )
    plan = generate_plan(request, today=day)
    assert plan.health is PlanHealth.NOT_RECOVERABLE
    assert plan.unscheduled[0].recoverable is False
    assert "Project" in plan.health_reason
