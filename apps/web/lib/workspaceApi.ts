import { apiFetch } from "./http";
import type {
  BusyBlock,
  CalendarConnection,
  CanvasConnection,
  CompletedTask,
  DailyAvailability,
  EstimateSample,
  LockedSession,
  Plan,
  Preferences,
  ProtectedBlock,
  Task,
} from "./types";

/** Everything StudyFlow saves for a browser session. Mirrors apps/api/app/workspace.py. */
export type WorkspaceState = {
  tasks: Task[];
  completed: CompletedTask[];
  availability: DailyAvailability[];
  preferences: Preferences;
  protectedBlocks: ProtectedBlock[];
  busyTime: BusyBlock[];
  lockedSessions: LockedSession[];
  blockedDates: string[];
  calendar: CalendarConnection | null;
  plan: Plan | null;
  planKey: string;
  estimateHistory: EstimateSample[];
  onboardedAt: string | null;
};

type WorkspaceDto = {
  version: 1;
  tasks: Task[];
  completed: CompletedTask[];
  availability: DailyAvailability[];
  preferences: Preferences;
  protected_blocks: ProtectedBlock[];
  busy_time: BusyBlock[];
  locked_sessions: LockedSession[];
  blocked_dates: string[];
  calendar: { busy_events: number; calendars_scanned: number; last_synced: string } | null;
  plan: Plan | null;
  plan_key: string;
  estimate_history?: EstimateSample[];
  onboarded_at?: string | null;
};

type LoadResponse = {
  workspace: WorkspaceDto | null;
  canvas: { canvas_url: string; display_name: string; method?: "token" | "feed"; connected_at: string | null; last_synced: string | null } | null;
  saved_at: string | null;
};

export type LoadedWorkspace = {
  state: Partial<WorkspaceState> | null;
  canvas: CanvasConnection | null;
  savedAt: Date | null;
};

export async function loadWorkspace(): Promise<LoadedWorkspace> {
  const data = await apiFetch<LoadResponse>("/api/v1/workspace");
  const ws = data.workspace;
  return {
    savedAt: data.saved_at ? new Date(data.saved_at) : null,
    canvas: data.canvas
      ? {
          displayName: data.canvas.display_name,
          canvasUrl: data.canvas.canvas_url,
          method: data.canvas.method ?? "token",
          lastSynced: data.canvas.last_synced ? new Date(data.canvas.last_synced) : null,
        }
      : null,
    state: ws && {
      tasks: ws.tasks,
      completed: ws.completed,
      availability: ws.availability.length === 7 ? ws.availability : undefined,
      preferences: Object.keys(ws.preferences).length ? ws.preferences : undefined,
      protectedBlocks: ws.protected_blocks,
      busyTime: ws.busy_time,
      lockedSessions: ws.locked_sessions,
      blockedDates: ws.blocked_dates,
      calendar: ws.calendar
        ? { busyEvents: ws.calendar.busy_events, calendarsScanned: ws.calendar.calendars_scanned, lastSynced: new Date(ws.calendar.last_synced) }
        : null,
      plan: ws.plan,
      planKey: ws.plan_key,
      estimateHistory: ws.estimate_history ?? [],
      onboardedAt: ws.onboarded_at ?? null,
    },
  };
}

export async function saveWorkspace(state: WorkspaceState): Promise<Date> {
  const body: WorkspaceDto = {
    version: 1,
    tasks: state.tasks,
    completed: state.completed,
    availability: state.availability,
    preferences: state.preferences,
    protected_blocks: state.protectedBlocks,
    // Event titles never leave the browser; only when someone is busy matters.
    busy_time: state.busyTime.map((block) => ({ ...block, label: "Calendar event" })),
    locked_sessions: state.lockedSessions,
    blocked_dates: state.blockedDates,
    calendar: state.calendar
      ? { busy_events: state.calendar.busyEvents, calendars_scanned: state.calendar.calendarsScanned, last_synced: state.calendar.lastSynced.toISOString() }
      : null,
    plan: state.plan,
    plan_key: state.planKey,
    // Keep the most recent samples; old habits matter less than recent ones.
    estimate_history: state.estimateHistory.slice(-300),
    onboarded_at: state.onboardedAt,
  };
  const result = await apiFetch<{ saved_at: string }>("/api/v1/workspace", { method: "PUT", json: body });
  return new Date(result.saved_at);
}

export function deleteWorkspace(): Promise<void> {
  return apiFetch("/api/v1/workspace", { method: "DELETE" });
}
