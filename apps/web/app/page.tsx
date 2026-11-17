"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { plural, toLocalParts } from "../lib/format";
import { importCalendarEvents, requestCalendarToken } from "../lib/googleCalendar";
import { generatePlan, type PlanInputs, planInputsKey } from "../lib/planApi";
import type {
  BusyBlock,
  CalendarConnection,
  CanvasConnection,
  DailyAvailability,
  Plan,
  Preferences,
  ProtectedBlock,
  Task,
  Toast,
} from "../lib/types";
import { useNow } from "../lib/useNow";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

  const [plan, setPlan] = useState<Plan | null>(null);
  const [planKey, setPlanKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  const [calendar, setCalendar] = useState<CalendarConnection | null>(null);
  const [calendarImporting, setCalendarImporting] = useState(false);
  const [canvas, setCanvas] = useState<CanvasConnection | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const inputs: PlanInputs = { tasks, availability, protectedBlocks, busyTime, preferences };
  const currentKey = planInputsKey(inputs);
  const stale = Boolean(plan) && currentKey !== planKey;
  const courseColor = useMemo(() => courseColorMap(tasks.map((task) => task.course)), [tasks]);
  const canvasTasks = tasks.filter((task) => task.source === "canvas");

  useEffect(() => {
    if (!toast || toast.tone === "error") return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function handleGenerate() {
    if (!tasks.length) {
      setToast({ text: "Add or import at least one assignment first.", tone: "error" });
      return;
    }
    setLoading(true);
    setToast(null);
    try {
      const next = await generatePlan(apiUrl, inputs);
      setPlan(next);
      setPlanKey(currentKey);
      setToast({
        text: next.sessions.length
          ? `Plan ready: ${plural(next.sessions.length, "focus session")} around your commitments.`
          : "No sessions fit before your deadlines. See what didn’t fit below.",
        tone: "info",
      });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "Couldn’t build a plan.", tone: "error" });
    } finally {
      setLoading(false);
    }
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
      <Sidebar studentName={canvas?.displayName ?? null} />

      <section className="workspace">
        <Topbar now={now} loading={loading} hasTasks={tasks.length > 0} hasPlan={Boolean(plan)} stale={stale} onGenerate={handleGenerate} />

        <div className="toast-region" aria-live="polite">
          {toast && (
            <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
              <Icon name={toast.tone === "error" ? "alert" : "check"} />
              <span>{toast.text}</span>
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
        />

        {plan?.warnings.length ? (
          <section className="warnings" aria-label="Warnings">
            {plan.warnings.map((warning) => <p key={warning}><span>!</span>{warning}</p>)}
          </section>
        ) : null}

        <section className="content-grid">
          <PlanTimeline now={now} plan={plan} stale={stale} loading={loading} courseColor={courseColor} onGenerate={handleGenerate} />
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
            onRemove={(id) => setTasks((current) => current.filter((task) => task.id !== id))}
          />
        </section>

        <PreferencesPanel
          availability={availability}
          onAvailabilityChange={(day, changes) => setAvailability((current) => current.map((item) => (item.day_of_week === day ? { ...item, ...changes } : item)))}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          protectedBlocks={protectedBlocks}
          onProtectedBlocksChange={setProtectedBlocks}
        />
      </section>

      {canvasOpen && (
        <CanvasErrorBoundary onClose={closeCanvas}>
          <CanvasModal
            apiUrl={apiUrl}
            now={now}
            connection={canvas}
            existingTasks={canvasTasks}
            onClose={closeCanvas}
            onConnected={setCanvas}
            onImport={handleCanvasImport}
          />
        </CanvasErrorBoundary>
      )}
    </main>
  );
}
