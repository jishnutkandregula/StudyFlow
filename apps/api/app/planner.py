from __future__ import annotations

from datetime import date, datetime, time, timedelta
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class PlanHealth(str, Enum):
    """How realistic the plan is, from the student's point of view."""

    ON_TRACK = "on_track"
    TIGHT = "tight"
    AT_RISK = "at_risk"
    NOT_RECOVERABLE = "not_recoverable"


# Shortest session worth suggesting when a gap is smaller than the preferred focus block.
MIN_FLEX_SESSION_MINUTES = 25


class Task(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=160)
    course: str = Field(min_length=1, max_length=80)
    due_date: date
    # Optional local due time. Without one, work may be scheduled until the end of due_date.
    due_time: Optional[time] = None  # noqa: UP045 -- Python 3.9 runtime
    estimated_minutes: int = Field(gt=0, le=10_080)
    priority: int = Field(default=3, ge=1, le=5)
    course_weight: float = Field(default=1.0, gt=0, le=100)


class AvailabilityBlock(BaseModel):
    date: date
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def ends_after_start(self) -> AvailabilityBlock:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class RecurringAvailability(BaseModel):
    """A weekly study window. Monday is 0 and Sunday is 6."""

    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    is_day_off: bool = False

    @model_validator(mode="after")
    def ends_after_start(self) -> RecurringAvailability:
        if not self.is_day_off and self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class ProtectedTimeBlock(BaseModel):
    """A recurring commitment that must never receive a study session in V1."""

    label: str = Field(min_length=1, max_length=60)
    days_of_week: list[int] = Field(min_length=1, max_length=7)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def is_valid(self) -> ProtectedTimeBlock:
        if len(set(self.days_of_week)) != len(self.days_of_week) or any(
            day < 0 or day > 6 for day in self.days_of_week
        ):
            raise ValueError("days_of_week must contain unique values from 0 through 6")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class BusyTimeBlock(BaseModel):
    """A one-time imported calendar event that must never receive a study session."""

    date: date
    start_time: time
    end_time: time
    label: str = Field(default="Calendar event", min_length=1, max_length=160)
    # Where it came from, so re-syncing one source replaces only its own blocks.
    source: Literal["google", "canvas"] = "google"

    @model_validator(mode="after")
    def ends_after_start(self) -> BusyTimeBlock:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class LockedSession(BaseModel):
    """A session the student pinned; it stays put and everything else plans around it."""

    task_id: str
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def ends_after_start(self) -> LockedSession:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class MealWindow(BaseModel):
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def ends_after_start(self) -> MealWindow:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be later than start_time")
        return self


class PlanningPreferences(BaseModel):
    sleep_start: time = time(23, 0)
    wake_time: time = time(7, 0)
    meals: list[MealWindow] = Field(default_factory=list, max_length=2)
    focus_session_minutes: int = Field(default=50, ge=25, le=120)
    short_break_minutes: int = Field(default=10, ge=5, le=30)
    max_study_minutes_per_day: int = Field(default=360, ge=60, le=720)


class PlanningRequest(BaseModel):
    tasks: list[Task] = Field(min_length=1)
    # Explicit availability remains supported for a simple/manual request.
    availability: list[AvailabilityBlock] = Field(default_factory=list)
    recurring_availability: list[RecurringAvailability] = Field(default_factory=list)
    protected_time: list[ProtectedTimeBlock] = Field(default_factory=list)
    busy_time: list[BusyTimeBlock] = Field(default_factory=list)
    preferences: Optional[PlanningPreferences] = None  # noqa: UP045 -- Python 3.9 runtime
    # The student's current local time. Nothing is scheduled before it, so a plan generated
    # at 7 PM never suggests a session that already started at 9 AM.
    planning_start: Optional[datetime] = None  # noqa: UP045 -- Python 3.9 runtime
    locked_sessions: list[LockedSession] = Field(default_factory=list, max_length=200)
    # One-off days with no studying at all, e.g. "I can't do anything today".
    blocked_dates: list[date] = Field(default_factory=list, max_length=60)
    max_session_minutes: int = Field(default=90, ge=15, le=180)
    minimum_break_minutes: int = Field(default=10, ge=0, le=60)

    @model_validator(mode="after")
    def has_availability_source(self) -> PlanningRequest:
        if not self.availability and not self.recurring_availability:
            raise ValueError("Provide availability or recurring_availability")
        return self


class PlannedSession(BaseModel):
    task_id: str
    task_title: str
    course: str
    starts_at: datetime
    ends_at: datetime
    minutes: int
    explanation: str
    locked: bool = False


class UnscheduledTask(BaseModel):
    task_id: str
    task_title: str
    course: str
    remaining_minutes: int
    risk: RiskLevel
    reason: str
    # False when the task cannot fit before its deadline even if nothing else were planned.
    recoverable: bool = True


class PlanningResponse(BaseModel):
    sessions: list[PlannedSession]
    unscheduled: list[UnscheduledTask]
    scheduled_minutes: int
    requested_minutes: int
    available_minutes: int
    risk: RiskLevel
    health: PlanHealth = PlanHealth.ON_TRACK
    health_reason: str = ""
    explanation: str
    warnings: list[str] = Field(default_factory=list)


def _deadline(task: Task) -> datetime:
    return datetime.combine(task.due_date, task.due_time or time.max)


def _due_label(task: Task) -> str:
    """Human-friendly deadline, e.g. "Wed Nov 18 at 5:59 PM"."""
    label = f"{task.due_date:%a %b} {task.due_date.day}"
    if task.due_time is None:
        return label
    clock = task.due_time.strftime("%I:%M %p").lstrip("0")
    return f"{label} at {clock}"


def _task_sort_key(task: Task) -> tuple[datetime, float, int, str]:
    return (_deadline(task), -task.course_weight, -task.priority, task.title.lower())


def _risk(remaining_minutes: int, due_date: date, today: date) -> RiskLevel:
    if remaining_minutes == 0:
        return RiskLevel.LOW
    if due_date <= today + timedelta(days=1):
        return RiskLevel.HIGH
    return RiskLevel.MEDIUM


def _format_minutes(minutes: int) -> str:
    hours, rest = divmod(minutes, 60)
    if not hours:
        return f"{rest}m"
    return f"{hours}h {rest}m" if rest else f"{hours}h"


def _health(
    unscheduled: list[UnscheduledTask], scheduled_minutes: int, available_minutes: int
) -> tuple[PlanHealth, str]:
    blocked = [item for item in unscheduled if not item.recoverable]
    if blocked:
        names = ", ".join(item.task_title for item in blocked[:2])
        return (
            PlanHealth.NOT_RECOVERABLE,
            f"{names} can't fit before {'its' if len(blocked) == 1 else 'their'} deadline even "
            "with nothing else planned. Something has to change: more time, a smaller "
            "estimate, or an extension.",
        )
    if unscheduled:
        count = len(unscheduled)
        return (
            PlanHealth.AT_RISK,
            f"{count} {'item doesn’t' if count == 1 else 'items don’t'} fit as planned, but "
            f"{'it' if count == 1 else 'each'} could fit on its own. Reprioritize, trim an "
            "estimate, or add study time.",
        )
    utilization = scheduled_minutes / available_minutes if available_minutes else 1.0
    if utilization >= 0.8:
        return (
            PlanHealth.TIGHT,
            f"Everything fits, but it uses {round(utilization * 100)}% of your free study time, "
            "so there’s little room for surprises.",
        )
    spare = _format_minutes(max(0, available_minutes - scheduled_minutes))
    return PlanHealth.ON_TRACK, f"Everything fits with {spare} of free study time to spare."


def _interval_minutes(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() // 60))


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def _base_availability(request: PlanningRequest, reference_date: date) -> list[AvailabilityBlock]:
    """Use recurring windows when supplied; otherwise preserve the manual MVP input."""

    if not request.recurring_availability:
        return request.availability

    horizon = max(task.due_date for task in request.tasks)
    by_weekday = {item.day_of_week: item for item in request.recurring_availability}
    blocks: list[AvailabilityBlock] = []
    for day in _date_range(reference_date, horizon):
        item = by_weekday.get(day.weekday())
        if item and not item.is_day_off:
            blocks.append(
                AvailabilityBlock(date=day, start_time=item.start_time, end_time=item.end_time)
            )
    return blocks


def _blocked_intervals(day: date, request: PlanningRequest) -> list[tuple[datetime, datetime]]:
    """Build same-day intervals that must be subtracted from availability."""

    blocked: list[tuple[datetime, datetime]] = []
    day_start = datetime.combine(day, time.min)
    day_end = day_start + timedelta(days=1)
    if day in request.blocked_dates:
        return [(day_start, day_end)]
    for locked in request.locked_sessions:
        if locked.starts_at < day_end and locked.ends_at > day_start:
            blocked.append((locked.starts_at, locked.ends_at))
    if request.planning_start is not None and request.planning_start.date() == day:
        blocked.append((datetime.combine(day, time.min), request.planning_start))
    for item in request.busy_time:
        if item.date == day:
            blocked.append(
                (datetime.combine(day, item.start_time), datetime.combine(day, item.end_time))
            )

    preferences = request.preferences
    if preferences is None:
        return blocked

    sleep_start = datetime.combine(day, preferences.sleep_start)
    wake_time = datetime.combine(day, preferences.wake_time)

    # An overnight sleep schedule, e.g. 23:00 -> 07:00, blocks the beginning and end
    # of every calendar day. A same-day interval is also accepted for flexibility.
    if preferences.sleep_start > preferences.wake_time:
        blocked.extend([(day_start, wake_time), (sleep_start, day_end)])
    else:
        blocked.append((sleep_start, wake_time))

    for meal in preferences.meals:
        blocked.append(
            (datetime.combine(day, meal.start_time), datetime.combine(day, meal.end_time))
        )
    for item in request.protected_time:
        if day.weekday() in item.days_of_week:
            blocked.append(
                (datetime.combine(day, item.start_time), datetime.combine(day, item.end_time))
            )
    return blocked


def _subtract_intervals(
    start: datetime, end: datetime, blocked: list[tuple[datetime, datetime]]
) -> list[tuple[datetime, datetime]]:
    """Return usable fragments of [start, end) after merging overlapping exclusions."""

    clipped = sorted(
        (
            (max(start, left), min(end, right))
            for left, right in blocked
            if right > start and left < end
        ),
        key=lambda item: item[0],
    )
    fragments: list[tuple[datetime, datetime]] = []
    cursor = start
    for left, right in clipped:
        if right <= cursor:
            continue
        if left > cursor:
            fragments.append((cursor, left))
        cursor = max(cursor, right)
    if cursor < end:
        fragments.append((cursor, end))
    return fragments


def generate_plan(request: PlanningRequest, today: date | None = None) -> PlanningResponse:
    """Build an explainable, deadline-first baseline study plan.

    This deterministic approach is intentionally easy to inspect. It never creates more
    work than fits in supplied availability and reports any shortfall instead of hiding it.
    """

    reference_date = today or (
        request.planning_start.date() if request.planning_start else date.today()
    )
    remaining = {task.id: task.estimated_minutes for task in request.tasks}
    sessions: list[PlannedSession] = []
    blocks = sorted(
        _base_availability(request, reference_date),
        key=lambda block: (block.date, block.start_time),
    )
    preferences = request.preferences
    session_limit = (
        preferences.focus_session_minutes if preferences else request.max_session_minutes
    )
    break_minutes = (
        preferences.short_break_minutes if preferences else request.minimum_break_minutes
    )
    daily_cap = preferences.max_study_minutes_per_day if preferences else 24 * 60
    daily_scheduled: dict[date, int] = {}
    tasks_by_id = {task.id: task for task in request.tasks}

    # Locked sessions are fixed commitments: count their work first, then plan around them.
    locked_minutes = 0
    for locked in request.locked_sessions:
        task = tasks_by_id.get(locked.task_id)
        if task is None:
            continue
        minutes = _interval_minutes(locked.starts_at, locked.ends_at)
        remaining[task.id] = max(0, remaining[task.id] - minutes)
        day = locked.starts_at.date()
        daily_scheduled[day] = daily_scheduled.get(day, 0) + minutes
        locked_minutes += minutes
        sessions.append(
            PlannedSession(
                task_id=task.id,
                task_title=task.title,
                course=task.course,
                starts_at=locked.starts_at,
                ends_at=locked.ends_at,
                minutes=minutes,
                explanation="Locked by you. StudyFlow keeps it in place and plans everything else "
                "around it.",
                locked=True,
            )
        )

    for block in blocks:
        block_start = datetime.combine(block.date, block.start_time)
        block_end = datetime.combine(block.date, block.end_time)
        usable_fragments = _subtract_intervals(
            block_start, block_end, _blocked_intervals(block.date, request)
        )

        for fragment_start, fragment_end in usable_fragments:
            cursor = fragment_start
            while cursor < fragment_end and daily_scheduled.get(block.date, 0) < daily_cap:
                # A task is eligible only if a minimum-length session still ends by its deadline.
                eligible = [
                    task
                    for task in request.tasks
                    if remaining[task.id] > 0
                    and cursor + timedelta(minutes=15) <= _deadline(task)
                ]
                if not eligible:
                    break

                task = min(eligible, key=_task_sort_key)
                minutes_left = _interval_minutes(cursor, fragment_end)
                day_remaining = daily_cap - daily_scheduled.get(block.date, 0)
                minutes_to_deadline = _interval_minutes(cursor, _deadline(task))
                target_minutes = min(
                    remaining[task.id], session_limit, day_remaining, minutes_to_deadline
                )
                # Do not squeeze a full focus session into a smaller gap. A shorter task
                # is allowed only when it genuinely fits inside the remaining interval.
                if preferences is None:
                    target_minutes = min(target_minutes, minutes_left)
                elif target_minutes > minutes_left >= MIN_FLEX_SESSION_MINUTES:
                    # Use a shorter session rather than wasting a usable gap.
                    target_minutes = minutes_left
                if target_minutes > minutes_left or target_minutes < 15:
                    break

                end = cursor + timedelta(minutes=target_minutes)
                sessions.append(
                    PlannedSession(
                        task_id=task.id,
                        task_title=task.title,
                        course=task.course,
                        starts_at=cursor,
                        ends_at=end,
                        minutes=target_minutes,
                        explanation=(
                            f"Scheduled because {task.title} is due "
                            f"{_due_label(task)} and "
                            "has the highest deadline-and-importance priority among work that fits "
                            "this protected schedule."
                        ),
                    )
                )
                remaining[task.id] -= target_minutes
                daily_scheduled[block.date] = daily_scheduled.get(block.date, 0) + target_minutes
                cursor = end + timedelta(minutes=break_minutes)

    locked_by_day: dict[date, int] = {}
    for session in sessions:
        if session.locked:
            day = session.starts_at.date()
            locked_by_day[day] = locked_by_day.get(day, 0) + session.minutes

    def capacity_until(deadline: datetime) -> int:
        """Free study minutes before `deadline`, honoring every constraint and the daily cap."""

        total = 0
        for day in sorted({block.date for block in blocks}):
            fragments: list[tuple[datetime, datetime]] = []
            for block in (item for item in blocks if item.date == day):
                fragments.extend(
                    _subtract_intervals(
                        datetime.combine(block.date, block.start_time),
                        min(datetime.combine(block.date, block.end_time), deadline),
                        _blocked_intervals(day, request),
                    )
                )
            free = sum(_interval_minutes(start, end) for start, end in fragments)
            total += max(0, min(daily_cap - locked_by_day.get(day, 0), free))
        return total

    # Capacity represents time usable by the planner, not simply raw calendar windows.
    available_minutes = capacity_until(datetime.max) + locked_minutes

    locked_by_task: dict[str, int] = {}
    for session in sessions:
        if session.locked:
            locked_by_task[session.task_id] = (
                locked_by_task.get(session.task_id, 0) + session.minutes
            )

    unscheduled: list[UnscheduledTask] = []
    for task in sorted(request.tasks, key=_task_sort_key):
        if remaining[task.id] <= 0:
            continue
        need = task.estimated_minutes - locked_by_task.get(task.id, 0)
        capacity = capacity_until(_deadline(task))
        recoverable = need <= capacity
        unscheduled.append(
            UnscheduledTask(
                task_id=task.id,
                task_title=task.title,
                course=task.course,
                remaining_minutes=remaining[task.id],
                risk=_risk(remaining[task.id], task.due_date, reference_date),
                recoverable=recoverable,
                reason=(
                    "Other deadlines are using the time before this one. It would fit on its "
                    "own, so reprioritize, trim an estimate, or add availability."
                    if recoverable
                    else f"Needs {need} more minutes but only {capacity} free minutes remain "
                    "before it is due. Change a constraint: add availability, lower the "
                    "estimate, or ask for an extension."
                ),
            )
        )
    overall_risk = (
        RiskLevel.HIGH
        if any(item.risk == RiskLevel.HIGH for item in unscheduled)
        else RiskLevel.MEDIUM
        if unscheduled
        else RiskLevel.LOW
    )
    sessions.sort(key=lambda session: session.starts_at)
    scheduled_minutes = sum(session.minutes for session in sessions)
    requested_minutes = sum(task.estimated_minutes for task in request.tasks)
    health, health_reason = _health(unscheduled, scheduled_minutes, available_minutes)

    warnings: list[str] = []
    if not blocks:
        warnings.append("No schedulable time exists before your listed deadlines.")
    for task in request.tasks:
        if remaining[task.id] > 0 and task.due_date <= reference_date + timedelta(days=1):
            warnings.append(
                f"{task.title} is due {_due_label(task)} but does not fully fit "
                "in your protected schedule."
            )

    return PlanningResponse(
        sessions=sessions,
        unscheduled=unscheduled,
        scheduled_minutes=scheduled_minutes,
        requested_minutes=requested_minutes,
        available_minutes=available_minutes,
        risk=overall_risk,
        health=health,
        health_reason=health_reason,
        explanation=(
            "StudyFlow schedules nearest deadlines first, then uses course weight and priority "
            "to break ties. It respects your availability, protected time, meals, sleep, "
            "and daily cap."
        ),
        warnings=warnings,
    )
