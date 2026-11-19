// Shared frontend domain types. Planner request/response shapes mirror
// apps/api/app/planner.py; keep the two in sync.

export type TaskSource = "manual" | "canvas" | "sample";

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
  /** Kind of work, from the estimator (essay, lab, problem_set, ...). */
  category?: string | null;
  /** Why StudyFlow suggested the estimate it did. */
  estimate_reason?: string | null;
  /** StudyFlow's first estimate, before any change; compared with logged time to learn. */
  original_estimate?: number | null;
  /** Focus time the student has logged on this task so far. */
  logged_minutes?: number;
};

/** A finished task's first estimate vs. the time it really took; calibrates future estimates. */
export type EstimateSample = { category: string; course: string; estimated_minutes: number; actual_minutes: number };

export type Session = {
  task_id: string;
  task_title: string;
  course: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  explanation: string;
  locked?: boolean;
};

export type LockedSession = { task_id: string; starts_at: string; ends_at: string };

export type PlanHealth = "on_track" | "tight" | "at_risk" | "not_recoverable";

export type RiskLevel = "low" | "medium" | "high";

export type UnscheduledItem = {
  task_id: string;
  task_title: string;
  course: string;
  remaining_minutes: number;
  risk: RiskLevel;
  reason: string;
  recoverable?: boolean;
};

export type Plan = {
  sessions: Session[];
  unscheduled: UnscheduledItem[];
  scheduled_minutes: number;
  requested_minutes: number;
  available_minutes: number;
  risk: RiskLevel;
  health: PlanHealth;
  health_reason: string;
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

export type BusySource = "google" | "canvas";
export type BusyBlock = { date: string; start_time: string; end_time: string; label: string; source?: BusySource };

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
  /** "feed": the private Calendar Feed link (no token); "token": a personal access token. */
  method: "token" | "feed";
  /** Null when connected but not yet synced. */
  lastSynced: Date | null;
};

export type CompletedTask = { id: string; title: string; course: string };

export type SaveStatus =
  | { state: "loading" }
  | { state: "saved"; at: Date | null }
  | { state: "saving" }
  | { state: "error"; message: string };

export type CalendarConnection = {
  busyEvents: number;
  calendarsScanned: number;
  lastSynced: Date;
};

export type Toast = {
  text: string;
  tone: "info" | "error";
  action?: { label: string; onClick: () => void };
};

/** What a replan changed, shown so the student never has to diff plans by eye. */
export type PlanChange = {
  cause: string;
  healthBefore: PlanHealth;
  healthAfter: PlanHealth;
  nowFits: string[];
  noLongerFits: string[];
  movedSessions: number;
};
