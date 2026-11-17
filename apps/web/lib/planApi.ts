import { localNowIso } from "./format";
import { ApiError, apiFetch } from "./http";
import type {
  BusyBlock,
  DailyAvailability,
  LockedSession,
  Plan,
  PlanChange,
  Preferences,
  ProtectedBlock,
  Task,
} from "./types";

export type PlanInputs = {
  tasks: Task[];
  availability: DailyAvailability[];
  protectedBlocks: ProtectedBlock[];
  busyTime: BusyBlock[];
  preferences: Preferences;
  lockedSessions: LockedSession[];
  /** One-off YYYY-MM-DD days with no studying. */
  blockedDates: string[];
};

/** Build the planner request body. Only fields the API understands are sent. */
export function buildPlanRequest(inputs: PlanInputs) {
  const { tasks, availability, protectedBlocks, busyTime, preferences, lockedSessions, blockedDates } = inputs;
  const taskIds = new Set(tasks.map((task) => task.id));
  return {
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      course: task.course,
      due_date: task.due_date,
      due_time: task.due_time,
      estimated_minutes: task.estimated_minutes,
      priority: task.priority,
      course_weight: task.course_weight,
    })),
    recurring_availability: availability.map(({ label: _label, ...day }) => day),
    protected_time: protectedBlocks,
    busy_time: busyTime,
    locked_sessions: lockedSessions.filter((session) => taskIds.has(session.task_id)),
    blocked_dates: blockedDates,
    preferences: {
      sleep_start: preferences.sleep_start,
      wake_time: preferences.wake_time,
      meals: [
        { start_time: preferences.lunch_start, end_time: preferences.lunch_end },
        { start_time: preferences.dinner_start, end_time: preferences.dinner_end },
      ],
      focus_session_minutes: Number(preferences.focus_session_minutes),
      short_break_minutes: Number(preferences.short_break_minutes),
      max_study_minutes_per_day: Number(preferences.max_study_minutes_per_day),
    },
  };
}

/** A stable fingerprint of planner inputs, used to tell when a plan is out of date. */
export function planInputsKey(inputs: PlanInputs): string {
  // Busy-event titles aren't saved, so they must not make a reloaded plan look stale.
  const request = buildPlanRequest(inputs);
  return JSON.stringify({ ...request, busy_time: request.busy_time.map(({ label: _label, ...block }) => block) });
}

export async function generatePlan(inputs: PlanInputs): Promise<Plan> {
  try {
    return await apiFetch<Plan>("/api/v1/plans/generate", {
      method: "POST",
      json: { ...buildPlanRequest(inputs), planning_start: localNowIso() },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      throw new Error("Some planning settings are invalid — check that every time range ends after it starts.");
    }
    throw error;
  }
}

/** Summarize what changed between two plans for the same student. */
export function diffPlans(before: Plan, after: Plan, cause: string): PlanChange {
  const unscheduledBefore = new Set(before.unscheduled.map((item) => item.task_id));
  const unscheduledAfter = new Set(after.unscheduled.map((item) => item.task_id));
  const titles = new Map([...before.sessions, ...after.sessions].map((s) => [s.task_id, s.task_title]));
  for (const item of [...before.unscheduled, ...after.unscheduled]) titles.set(item.task_id, item.task_title);
  const afterTasks = new Set(after.sessions.map((s) => s.task_id));
  const beforeSlots = new Set(before.sessions.map((s) => `${s.task_id}@${s.starts_at}`));
  return {
    cause,
    healthBefore: before.health,
    healthAfter: after.health,
    // Only work that is still planned "now fits"; completed or removed tasks simply drop out.
    nowFits: [...unscheduledBefore].filter((id) => !unscheduledAfter.has(id) && afterTasks.has(id)).map((id) => titles.get(id)!),
    noLongerFits: [...unscheduledAfter].filter((id) => !unscheduledBefore.has(id)).map((id) => titles.get(id)!),
    movedSessions: after.sessions.filter((s) => !s.locked && !beforeSlots.has(`${s.task_id}@${s.starts_at}`)).length,
  };
}
