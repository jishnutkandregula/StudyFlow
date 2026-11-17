"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasErrorBoundary } from "../components/canvas/CanvasErrorBoundary";
import { type CanvasImport, CanvasModal } from "../components/canvas/CanvasModal";
import { ConnectionRibbon } from "../components/ConnectionRibbon";
import { Icon } from "../components/Icon";
import { PlanTimeline } from "../components/PlanTimeline";
import { PreferencesPanel } from "../components/PreferencesPanel";
import { Sidebar } from "../components/Sidebar";
import { TodayOverview } from "../components/TodayOverview";
import { Topbar } from "../components/Topbar";
import { WorkloadPanel } from "../components/WorkloadPanel";
import { courseColorMap } from "../lib/courseColors";
import { formatHours, plural, toDateKey, toLocalParts } from "../lib/format";
import { importCalendarEvents, requestCalendarToken } from "../lib/googleCalendar";
import { diffPlans, generatePlan, type PlanInputs, planInputsKey } from "../lib/planApi";
import { deleteWorkspace, loadWorkspace, saveWorkspace, type WorkspaceState } from "../lib/workspaceApi";
import type {
  BusyBlock,
  CalendarConnection,
  CanvasConnection,
  CompletedTask,
  DailyAvailability,
  LockedSession,
  Plan,
  PlanChange,
  Preferences,
  ProtectedBlock,
  SaveStatus,
  Session,
  Task,
  Toast,
} from "../lib/types";
import { useNow } from "../lib/useNow";

const SAVE_DEBOUNCE_MS = 700;

const defaultWeek: DailyAvailability[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, day) => ({
  day_of_week: day,
  label,
  start_time: day < 5 ? "18:30:00" : "10:00:00",
  end_time: day < 5 ? "21:30:00" : "14:00:00",
  is_day_off: false,
}));

const defaultPreferences: Preferences = {
  sleep_start: "23:00:00",
  wake_time: "07:00:00",
  lunch_start: "12:00:00",
  lunch_end: "13:00:00",
  dinner_start: "18:00:00",
  dinner_end: "19:00:00",
  focus_session_minutes: "50",
  short_break_minutes: "10",
  max_study_minutes_per_day: "240",
};

export default function Home() {
  const now = useNow();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availability, setAvailability] = useState(defaultWeek);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [protectedBlocks, setProtectedBlocks] = useState<ProtectedBlock[]>([]);
  const [busyTime, setBusyTime] = useState<BusyBlock[]>([]);
  const [lockedSessions, setLockedSessions] = useState<LockedSession[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [change, setChange] = useState<PlanChange | null>(null);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [planKey, setPlanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  const [calendar, setCalendar] = useState<CalendarConnection | null>(null);
  const [calendarImporting, setCalendarImporting] = useState(false);
  const [canvas, setCanvas] = useState<CanvasConnection | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "loading" });
  const hydrated = saveStatus.state !== "loading";
  const lastSavedJson = useRef<string | null>(null);

  const inputs: PlanInputs = { tasks, availability, protectedBlocks, busyTime, preferences, lockedSessions, blockedDates };
  const todayKey = now ? toDateKey(now) : null;
  const currentKey = planInputsKey(inputs);
  const stale = Boolean(plan) && currentKey !== planKey;
  const courseColor = useMemo(() => courseColorMap(tasks.map((task) => task.course)), [tasks]);
  const canvasTasks = tasks.filter((task) => task.source === "canvas");

  // Load this browser's saved workspace once. The server starts a session if there isn't one.
  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then(({ state, canvas: savedCanvas, savedAt }) => {
        if (cancelled) return;
        if (state) {
          if (state.tasks) setTasks(state.tasks);
          if (state.completed) setCompleted(state.completed);
          if (state.availability) setAvailability(state.availability);
          if (state.preferences) setPreferences({ ...defaultPreferences, ...state.preferences });
          if (state.protectedBlocks) setProtectedBlocks(state.protectedBlocks);
          if (state.busyTime) setBusyTime(state.busyTime);
          if (state.lockedSessions) setLockedSessions(state.lockedSessions);
          if (state.blockedDates) setBlockedDates(state.blockedDates);
          setCalendar(state.calendar ?? null);
          setPlan(state.plan ?? null);
          setPlanKey(state.planKey ?? "");
        }
        setCanvas(savedCanvas);
        setSaveStatus({ state: "saved", at: savedAt });
      })
      .catch(() => {
        if (cancelled) return;
        setSaveStatus({ state: "error", message: "Couldn’t load your saved workspace." });
        setToast({ text: "Couldn’t load your saved workspace. Changes won’t be saved until the API is reachable.", tone: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workspace: WorkspaceState = {
    tasks,
    completed,
    availability,
    preferences,
    protectedBlocks,
    busyTime,
    lockedSessions,
    blockedDates,
    calendar,
    plan,
    planKey,
  };
  const workspaceJson = JSON.stringify(workspace);
  const latestWorkspace = useRef(workspace);
  latestWorkspace.current = workspace;

  // Autosave: debounce changes, then PUT the whole workspace. Skips the initial load.
  useEffect(() => {
    if (!hydrated) return;
    if (lastSavedJson.current === null) {
      lastSavedJson.current = workspaceJson;
      return;
    }
    if (workspaceJson === lastSavedJson.current) return;
    const id = window.setTimeout(() => {
      setSaveStatus({ state: "saving" });
      saveWorkspace(latestWorkspace.current)
        .then((at) => {
          lastSavedJson.current = workspaceJson;
          setSaveStatus({ state: "saved", at });
        })
        .catch((error) => {
          setSaveStatus({ state: "error", message: error instanceof Error ? error.message : "Save failed." });
        });
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [workspaceJson, hydrated]);

  async function handleDeleteData() {
    try {
      await deleteWorkspace();
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "Couldn’t delete your data.", tone: "error" });
      return;
    }
    // Start completely fresh: a reload creates a new, empty session.
    window.location.reload();
  }

  useEffect(() => {
    if (!toast || toast.tone === "error") return;
    const id = window.setTimeout(() => setToast(null), toast.action ? 9000 : 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  /**
   * The single path to a new plan. `cause` describes what the student did, so the
   * plan view can say what changed; `undo` restores the state from before the action.
   */
  async function runPlan(next: PlanInputs, cause: string | null, notice?: { text: string; undo: () => void }) {
    if (!next.tasks.length) {
      setPlan(null);
      setChange(null);
      if (notice) setToast({ text: notice.text, tone: "info", action: { label: "Undo", onClick: notice.undo } });
      return;
    }
    const previous = plan;
    setLoading(true);
    if (!notice) setToast(null);
    try {
      const result = await generatePlan(next);
      setPlan(result);
      setPlanKey(planInputsKey(next));
      setChange(previous && cause ? diffPlans(previous, result, cause) : null);
      setToast(
        notice
          ? { text: notice.text, tone: "info", action: { label: "Undo", onClick: notice.undo } }
          : {
              text: result.sessions.length
                ? `Plan ready: ${plural(result.sessions.length, "focus session")} around your commitments.`
                : "No sessions fit before your deadlines. See what didn’t fit below.",
              tone: "info",
            },
      );
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "Couldn’t build a plan.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    if (!tasks.length) {
      setToast({ text: "Add or import at least one assignment first.", tone: "error" });
      return;
    }
    void runPlan(inputs, plan ? "Replanned with your changes" : null);
  }

  /** Snapshot everything a session action can touch, so a single click can undo it. */
  function snapshot() {
    const saved = { tasks, lockedSessions, blockedDates, completed, plan, planKey };
    return () => {
      setTasks(saved.tasks);
      setLockedSessions(saved.lockedSessions);
      setBlockedDates(saved.blockedDates);
      setCompleted(saved.completed);
      setPlan(saved.plan);
      setPlanKey(saved.planKey);
      setChange(null);
      setToast({ text: "Undone.", tone: "info" });
    };
  }

  function applyAndReplan(
    patch: { tasks?: Task[]; lockedSessions?: LockedSession[]; blockedDates?: string[]; completed?: CompletedTask[] },
    cause: string,
    text: string,
  ) {
    const undo = snapshot();
    if (patch.tasks) setTasks(patch.tasks);
    if (patch.lockedSessions) setLockedSessions(patch.lockedSessions);
    if (patch.blockedDates) setBlockedDates(patch.blockedDates);
    if (patch.completed) setCompleted(patch.completed);
    void runPlan({ ...inputs, ...patch }, cause, { text, undo });
  }

  const sameSlot = (lock: LockedSession, session: Session) =>
    lock.task_id === session.task_id && lock.starts_at === session.starts_at;

  function handleSessionDone(session: Session) {
    const task = tasks.find((item) => item.id === session.task_id);
    if (!task) return;
    const left = task.estimated_minutes - session.minutes;
    const locks = lockedSessions.filter((lock) => !sameSlot(lock, session));
    if (left < 15) {
      applyAndReplan(
        {
          tasks: tasks.filter((item) => item.id !== task.id),
          lockedSessions: locks.filter((lock) => lock.task_id !== task.id),
          completed: [{ id: task.id, title: task.title, course: task.course }, ...completed],
        },
        `Finished “${task.title}”`,
        `${task.title} is finished. Its remaining sessions were freed up.`,
      );
    } else {
      applyAndReplan(
        { tasks: tasks.map((item) => (item.id === task.id ? { ...item, estimated_minutes: left } : item)), lockedSessions: locks },
        `Logged ${session.minutes}m on “${task.title}”`,
        `Nice. ${formatHours(left)} left on ${task.title}.`,
      );
    }
  }

  function handleMoreTime(session: Session) {
    const task = tasks.find((item) => item.id === session.task_id);
    if (!task) return;
    applyAndReplan(
      { tasks: tasks.map((item) => (item.id === task.id ? { ...item, estimated_minutes: item.estimated_minutes + 30 } : item)) },
      `“${task.title}” needs 30 more minutes`,
      `${task.title} is now estimated at ${formatHours(task.estimated_minutes + 30)}.`,
    );
  }

  function handleToggleLock(session: Session) {
    const locked = lockedSessions.some((lock) => sameSlot(lock, session));
    applyAndReplan(
      {
        lockedSessions: locked
          ? lockedSessions.filter((lock) => !sameSlot(lock, session))
          : [...lockedSessions, { task_id: session.task_id, starts_at: session.starts_at, ends_at: session.ends_at }],
      },
      locked ? `Unlocked “${session.task_title}”` : `Locked “${session.task_title}”`,
      locked ? "Unlocked. StudyFlow can move this session again." : "Locked. This session stays put through every replan.",
    );
  }

  function handleSkipToday() {
    if (!todayKey) return;
    applyAndReplan({ blockedDates: [...blockedDates, todayKey] }, "Took today off", "Today is off. Its work moved to later days.");
  }

  function handleUnskipToday() {
    if (!todayKey) return;
    applyAndReplan({ blockedDates: blockedDates.filter((day) => day !== todayKey) }, "Back on for today", "Today is available again.");
  }

  async function handleConnectCalendar() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setToast({ text: "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to apps/web/.env.local to enable Google Calendar.", tone: "error" });
      return;
    }
    setCalendarImporting(true);
    setToast(null);
    try {
      const token = await requestCalendarToken(clientId);
      const imported = await importCalendarEvents(token);
      // Only timed events block study time. All-day items (holidays, birthdays, OOO markers)
      // are skipped — assignments come from Canvas, not from the calendar.
      const busy = imported.events
        .filter((event) => event.start?.dateTime && event.end?.dateTime)
        .map((event) => {
          const start = toLocalParts(event.start!.dateTime!);
          const end = toLocalParts(event.end!.dateTime!);
          return { date: start.date, start_time: start.time, end_time: end.time, label: event.title.slice(0, 160) };
        })
        .filter((event) => event.start_time < event.end_time);
      setBusyTime(busy);
      setCalendar({ busyEvents: busy.length, calendarsScanned: imported.calendarsScanned, lastSynced: new Date() });
      setToast({
        text: `Google Calendar synced: ${plural(busy.length, "event")} from ${plural(imported.calendarsScanned, "calendar")} will be protected.`,
        tone: "info",
      });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "Google Calendar could not connect.", tone: "error" });
    } finally {
      setCalendarImporting(false);
    }
  }

  function handleCanvasImport({ tasks: imported, reviewedIds }: CanvasImport) {
    const reviewed = new Set(reviewedIds);
    setTasks((current) => [...current.filter((task) => !reviewed.has(task.id)), ...imported]);
  }

  const closeCanvas = useCallback(() => setCanvasOpen(false), []);

  return (
    <main className="flow-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />
      <Sidebar studentName={canvas?.displayName ?? null} saveStatus={saveStatus} now={now} />

      <section className={`workspace${hydrated ? "" : " is-loading"}`} aria-busy={!hydrated}>
        <Topbar now={now} loading={loading} hasTasks={tasks.length > 0} hasPlan={Boolean(plan)} stale={stale} onGenerate={handleGenerate} />

        <div className="toast-region" aria-live="polite">
          {toast && (
            <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
              <Icon name={toast.tone === "error" ? "alert" : "check"} />
              <span>{toast.text}</span>
              {toast.action && (
                <button className="toast-action" onClick={toast.action.onClick}>
                  <Icon name="undo" />{toast.action.label}
                </button>
              )}
              <button onClick={() => setToast(null)} aria-label="Dismiss"><Icon name="x" /></button>
            </div>
          )}
        </div>

        <ConnectionRibbon
          now={now}
          calendar={calendar}
          calendarImporting={calendarImporting}
          canvas={canvas}
          canvasAssignments={canvasTasks.length}
          onConnectCalendar={handleConnectCalendar}
          onOpenCanvas={() => setCanvasOpen(true)}
        />

        <TodayOverview
          now={now}
          tasks={tasks}
          plan={plan}
          loading={loading}
          courseColor={courseColor}
          onGenerate={handleGenerate}
          onOpenCanvas={() => setCanvasOpen(true)}
          onAddManual={() => {
            setShowCapture(true);
            document.getElementById("work")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onDone={handleSessionDone}
        />

        {plan?.warnings.length ? (
          <section className="warnings" aria-label="Warnings">
            {plan.warnings.map((warning) => <p key={warning}><span>!</span>{warning}</p>)}
          </section>
        ) : null}

        <section className="content-grid">
          <PlanTimeline
            now={now}
            plan={plan}
            stale={stale}
            loading={loading}
            change={change}
            todayBlocked={Boolean(todayKey && blockedDates.includes(todayKey))}
            courseColor={courseColor}
            onGenerate={handleGenerate}
            onDismissChange={() => setChange(null)}
            onDone={handleSessionDone}
            onMoreTime={handleMoreTime}
            onToggleLock={handleToggleLock}
            onSkipToday={handleSkipToday}
            onUnskipToday={handleUnskipToday}
          />
          <WorkloadPanel
            now={now}
            tasks={tasks}
            courseColor={courseColor}
            showCapture={showCapture}
            onToggleCapture={() => setShowCapture((current) => !current)}
            onAdd={(task) => {
              setTasks((current) => [...current, task]);
              setShowCapture(false);
              setToast({ text: `${task.title} added. Replan when you’re ready.`, tone: "info" });
            }}
            onRemove={(id) => {
              setTasks((current) => current.filter((task) => task.id !== id));
              setLockedSessions((current) => current.filter((lock) => lock.task_id !== id));
            }}
            onEstimateChange={(id, minutes) =>
              setTasks((current) => current.map((task) => (task.id === id ? { ...task, estimated_minutes: minutes } : task)))
            }
            completed={completed}
          />
        </section>

        <PreferencesPanel
          availability={availability}
          onAvailabilityChange={(day, changes) => setAvailability((current) => current.map((item) => (item.day_of_week === day ? { ...item, ...changes } : item)))}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          protectedBlocks={protectedBlocks}
          onProtectedBlocksChange={setProtectedBlocks}
          onDeleteData={handleDeleteData}
        />
      </section>

      {canvasOpen && (
        <CanvasErrorBoundary onClose={closeCanvas}>
          <CanvasModal
            now={now}
            connection={canvas}
            existingTasks={canvasTasks}
            completedIds={completed.map((item) => item.id)}
            onClose={closeCanvas}
            onConnected={setCanvas}
            onDisconnected={() => setCanvas(null)}
            onImport={handleCanvasImport}
          />
        </CanvasErrorBoundary>
      )}
    </main>
  );
}
