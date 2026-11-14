from __future__ import annotations

from datetime import date, datetime, time, timedelta
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Task(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=160)
    course: str = Field(min_length=1, max_length=80)
    due_date: date
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


class PlanningRequest(BaseModel):
    tasks: list[Task] = Field(min_length=1)
    availability: list[AvailabilityBlock] = Field(min_length=1)
    max_session_minutes: int = Field(default=90, ge=15, le=180)
    minimum_break_minutes: int = Field(default=10, ge=0, le=60)


class PlannedSession(BaseModel):
    task_id: str
    task_title: str
    course: str
    starts_at: datetime
    ends_at: datetime
    minutes: int
    explanation: str


class UnscheduledTask(BaseModel):
    task_id: str
    task_title: str
    course: str
    remaining_minutes: int
    risk: RiskLevel
    reason: str


class PlanningResponse(BaseModel):
    sessions: list[PlannedSession]
    unscheduled: list[UnscheduledTask]
    scheduled_minutes: int
    requested_minutes: int
    available_minutes: int
    risk: RiskLevel
    explanation: str


def _task_sort_key(task: Task) -> tuple[date, float, int, str]:
    return (task.due_date, -task.course_weight, -task.priority, task.title.lower())


def _risk(remaining_minutes: int, due_date: date, today: date) -> RiskLevel:
    if remaining_minutes == 0:
        return RiskLevel.LOW
    if due_date <= today + timedelta(days=1):
        return RiskLevel.HIGH
    return RiskLevel.MEDIUM


def generate_plan(request: PlanningRequest, today: date | None = None) -> PlanningResponse:
    """Build an explainable, deadline-first baseline study plan.

    This deterministic approach is intentionally easy to inspect. It never creates more
    work than fits in supplied availability and reports any shortfall instead of hiding it.
    """

    reference_date = today or date.today()
    remaining = {task.id: task.estimated_minutes for task in request.tasks}
    sessions: list[PlannedSession] = []
    available_minutes = 0
    blocks = sorted(request.availability, key=lambda block: (block.date, block.start_time))

    for block in blocks:
        cursor = datetime.combine(block.date, block.start_time)
        block_end = datetime.combine(block.date, block.end_time)
        available_minutes += int((block_end - cursor).total_seconds() // 60)

        while cursor < block_end:
            eligible = [
                task
                for task in request.tasks
                if remaining[task.id] > 0 and block.date <= task.due_date
            ]
            if not eligible:
                break

            task = min(eligible, key=_task_sort_key)
            minutes_left = int((block_end - cursor).total_seconds() // 60)
            session_minutes = min(remaining[task.id], request.max_session_minutes, minutes_left)
            if session_minutes < 15:
                break

            end = cursor + timedelta(minutes=session_minutes)
            sessions.append(
                PlannedSession(
                    task_id=task.id,
                    task_title=task.title,
                    course=task.course,
                    starts_at=cursor,
                    ends_at=end,
                    minutes=session_minutes,
                    explanation=(
                        f"Scheduled because {task.title} is due {task.due_date.isoformat()} and "
                        "has the highest deadline-and-importance priority among work that fits "
                        "here."
                    ),
                )
            )
            remaining[task.id] -= session_minutes
            cursor = end + timedelta(minutes=request.minimum_break_minutes)

    unscheduled = [
        UnscheduledTask(
            task_id=task.id,
            task_title=task.title,
            course=task.course,
            remaining_minutes=remaining[task.id],
            risk=_risk(remaining[task.id], task.due_date, reference_date),
            reason=(
                "There is not enough available study time before this deadline. "
                "Add availability, reduce the estimate, or renegotiate the deadline."
            ),
        )
        for task in sorted(request.tasks, key=_task_sort_key)
        if remaining[task.id] > 0
    ]
    overall_risk = (
        RiskLevel.HIGH
        if any(item.risk == RiskLevel.HIGH for item in unscheduled)
        else RiskLevel.MEDIUM
        if unscheduled
        else RiskLevel.LOW
    )
    scheduled_minutes = sum(session.minutes for session in sessions)
    requested_minutes = sum(task.estimated_minutes for task in request.tasks)

    return PlanningResponse(
        sessions=sessions,
        unscheduled=unscheduled,
        scheduled_minutes=scheduled_minutes,
        requested_minutes=requested_minutes,
        available_minutes=available_minutes,
        risk=overall_risk,
        explanation=(
            "StudyFlow schedules nearest deadlines first, then uses course weight and priority "
            "to break ties. It flags work that cannot fit before its deadline."
        ),
    )
