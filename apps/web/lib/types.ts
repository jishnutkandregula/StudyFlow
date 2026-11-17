// Shared frontend domain types. Planner request/response shapes mirror
// apps/api/app/planner.py; keep the two in sync.

export type TaskSource = "manual" | "canvas";

export type Task = {
  id: string;
  title: string;
  course: string;
  /** Local due date, YYYY-MM-DD. */
  due_date: string;
  /** Local due time, HH:MM:SS, or null when only the date is known. */
  due_time: string | null;
  estimated_minutes: number;
  priority: number;
  course_weight: number;
  source: TaskSource;
  points?: number | null;
  url?: string | null;
};

export type Session = {
  task_id: string;
  task_title: string;
  course: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  explanation: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type UnscheduledItem = {
  task_id: string;
  task_title: string;
  course: string;
  remaining_minutes: number;
  risk: RiskLevel;
  reason: string;
};

export type Plan = {
  sessions: Session[];
  unscheduled: UnscheduledItem[];
  scheduled_minutes: number;
  requested_minutes: number;
  available_minutes: number;
  risk: RiskLevel;
  explanation: string;
  warnings: string[];
};

export type DailyAvailability = {
  day_of_week: number;
  label: string;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};

export type ProtectedBlock = {
  label: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

export type BusyBlock = { date: string; start_time: string; end_time: string; label: string };

/** Form-friendly preferences: numeric fields stay strings while the user edits them. */
export type Preferences = {
  sleep_start: string;
  wake_time: string;
  lunch_start: string;
  lunch_end: string;
  dinner_start: string;
  dinner_end: string;
  focus_session_minutes: string;
  short_break_minutes: string;
  max_study_minutes_per_day: string;
};

export type CanvasConnection = {
  displayName: string;
  canvasUrl: string;
  courseCount: number;
  lastSynced: Date;
};

export type CalendarConnection = {
  busyEvents: number;
  calendarsScanned: number;
  lastSynced: Date;
};

export type Toast = { text: string; tone: "info" | "error" };
