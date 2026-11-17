import { localNowIso } from "./format";
import type { BusyBlock, DailyAvailability, Plan, Preferences, ProtectedBlock, Task } from "./types";

export type PlanInputs = {
  tasks: Task[];
  availability: DailyAvailability[];
  protectedBlocks: ProtectedBlock[];
  busyTime: BusyBlock[];
  preferences: Preferences;
};

/** Build the planner request body. Only fields the API understands are sent. */
export function buildPlanRequest(inputs: PlanInputs) {
  const { tasks, availability, protectedBlocks, busyTime, preferences } = inputs;
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
  return JSON.stringify(buildPlanRequest(inputs));
}

export async function generatePlan(apiUrl: string, inputs: PlanInputs): Promise<Plan> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/plans/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...buildPlanRequest(inputs), planning_start: localNowIso() }),
    });
  } catch {
    throw new Error("Couldn’t reach the StudyFlow planning service. Is the API running?");
  }
  if (response.status === 422) {
    throw new Error("Some planning settings are invalid — check that every time range ends after it starts.");
  }
  if (!response.ok) throw new Error("StudyFlow couldn’t build a plan right now. Try again in a moment.");
  return (await response.json()) as Plan;
}
