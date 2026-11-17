"use client";

import { FormEvent, useMemo, useState } from "react";
import { importCalendarEvents, requestCalendarToken } from "../lib/googleCalendar";
import { type CanvasAssignment, type CanvasCourse, connectCanvas as apiConnectCanvas, syncCanvas as apiSyncCanvas } from "../lib/canvasClient";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";

type Task = { id: string; title: string; course: string; due_date: string; estimated_minutes: number; priority: number; course_weight: number };
type Session = { task_id: string; task_title: string; course: string; starts_at: string; ends_at: string; minutes: number; explanation: string };
type Plan = { sessions: Session[]; unscheduled: Array<{ task_title: string; course: string; remaining_minutes: number; risk: string; reason: string }>; scheduled_minutes: number; requested_minutes: number; available_minutes: number; risk: "low" | "medium" | "high"; explanation: string; warnings: string[] };
type DailyAvailability = { day_of_week: number; label: string; start_time: string; end_time: string; is_day_off: boolean };
type ProtectedBlock = { label: string; days_of_week: number[]; start_time: string; end_time: string };
type BusyBlock = { date: string; start_time: string; end_time: string; label: string };

const initialTasks: Task[] = [
  { id: "lab-4", title: "Lab 4 · Graph traversal", course: "CSE 101", due_date: "2026-11-19", estimated_minutes: 180, priority: 5, course_weight: 20 },
  { id: "stats-set", title: "Problem set 7", course: "STAT 131", due_date: "2026-11-20", estimated_minutes: 120, priority: 4, course_weight: 15 },
  { id: "reading", title: "Reading response", course: "CSE 102", due_date: "2026-11-18", estimated_minutes: 45, priority: 3, course_weight: 5 },
];
const week: DailyAvailability[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, day_of_week) => ({ day_of_week, label, start_time: day_of_week < 5 ? "18:30:00" : "10:00:00", end_time: day_of_week < 5 ? "21:30:00" : "14:00:00", is_day_off: false }));
const courseColors = ["#B9A5FF", "#74E5C2", "#FFB38A", "#75B6FF"];

function formatHours(minutes: number) { const hours = Math.floor(minutes / 60); return `${hours ? `${hours}h ` : ""}${minutes % 60}m`; }
function Icon({ name }: { name: "spark" | "calendar" | "canvas" | "arrow" | "plus" | "bolt" | "check" | "settings" }) {
  const paths = {
    spark: <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    canvas: <><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="m8 15 2.5-3 2 2 3.5-5M8 9h.01" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks); const [plan, setPlan] = useState<Plan | null>(null); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  const [showCapture, setShowCapture] = useState(false); const [showPreferences, setShowPreferences] = useState(false);
  const [draft, setDraft] = useState({ title: "", course: "", due_date: "", estimated_minutes: "60", priority: "3" }); const [availability, setAvailability] = useState<DailyAvailability[]>(week);
  const [protectedBlocks, setProtectedBlocks] = useState<ProtectedBlock[]>([]); const [protectedDraft, setProtectedDraft] = useState<ProtectedBlock>({ label: "", days_of_week: [0], start_time: "17:00:00", end_time: "18:00:00" });
  const [calendarBusyTime, setCalendarBusyTime] = useState<BusyBlock[]>([]); const [calendarConnected, setCalendarConnected] = useState(false); const [calendarImporting, setCalendarImporting] = useState(false);
  const [canvasStep, setCanvasStep] = useState<"idle"|"url"|"token"|"connecting"|"review"|"syncing"|"connected"|"error">("idle"); const [canvasUrlDraft, setCanvasUrlDraft] = useState(""); const [canvasToken, setCanvasToken] = useState(""); const [canvasUser, setCanvasUser] = useState(""); const [canvasCourses, setCanvasCourses] = useState<CanvasCourse[]>([]); const [canvasSelectedIds, setCanvasSelectedIds] = useState<Set<string>>(new Set()); const [canvasError, setCanvasError] = useState(""); const [canvasAssignmentCount, setCanvasAssignmentCount] = useState(0); const canvasConnected = canvasStep === "connected";
  const [preferences, setPreferences] = useState({ sleep_start: "23:00:00", wake_time: "07:00:00", lunch_start: "12:00:00", lunch_end: "13:00:00", dinner_start: "18:00:00", dinner_end: "19:00:00", focus_session_minutes: "50", short_break_minutes: "10", max_study_minutes_per_day: "240" });
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"; const requestedMinutes = tasks.reduce((total, task) => total + task.estimated_minutes, 0); const courses = useMemo(() => [...new Set(tasks.map((task) => task.course))], [tasks]);
  function addTask(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!draft.title.trim() || !draft.course.trim() || !draft.due_date) return; setTasks((current) => [...current, { id: crypto.randomUUID(), title: draft.title.trim(), course: draft.course.trim(), due_date: draft.due_date, estimated_minutes: Number(draft.estimated_minutes), priority: Number(draft.priority), course_weight: Number(draft.priority) * 5 }]); setDraft({ title: "", course: "", due_date: "", estimated_minutes: "60", priority: "3" }); setShowCapture(false); setMessage("Added to your workspace. Generate a new flow when you’re ready."); }
  async function generatePlan() { setLoading(true); setMessage(""); try { const response = await fetch(`${apiUrl}/api/v1/plans/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks, recurring_availability: availability.map(({ label, ...item }) => item), protected_time: protectedBlocks, busy_time: calendarBusyTime, preferences: { sleep_start: preferences.sleep_start, wake_time: preferences.wake_time, meals: [{ start_time: preferences.lunch_start, end_time: preferences.lunch_end }, { start_time: preferences.dinner_start, end_time: preferences.dinner_end }], focus_session_minutes: Number(preferences.focus_session_minutes), short_break_minutes: Number(preferences.short_break_minutes), max_study_minutes_per_day: Number(preferences.max_study_minutes_per_day) } }) }); if (!response.ok) throw new Error("StudyFlow couldn’t build the flow for this week."); setPlan(await response.json()); setMessage("Your flow is ready. Every session protects the time you set aside."); } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn’t connect to the planning service."); } finally { setLoading(false); } }
  function updateAvailability(day: number, changes: Partial<DailyAvailability>) { setAvailability((current) => current.map((item) => item.day_of_week === day ? { ...item, ...changes } : item)); }
  function toggleProtectedDay(day: number) { setProtectedDraft((current) => ({ ...current, days_of_week: current.days_of_week.includes(day) ? current.days_of_week.filter((item) => item !== day) : [...current.days_of_week, day] })); }
  function addProtectedBlock() { if (!protectedDraft.label.trim() || !protectedDraft.days_of_week.length) return; setProtectedBlocks((current) => [...current, { ...protectedDraft, label: protectedDraft.label.trim() }]); setProtectedDraft({ label: "", days_of_week: [0], start_time: "17:00:00", end_time: "18:00:00" }); }
  function localCalendarParts(value: string) { const date = new Date(value); return { date: date.toLocaleDateString("en-CA"), time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) + ":00" }; }
  async function connectGoogleCalendar() { const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; if (!clientId) { setMessage("Google Calendar is ready to connect once NEXT_PUBLIC_GOOGLE_CLIENT_ID is added to .env.local."); return; } setCalendarImporting(true); setMessage(""); try { const token = await requestCalendarToken(clientId); const imported = await importCalendarEvents(token); const busy = imported.events.filter((event) => event.start?.dateTime && event.end?.dateTime).map((event) => { const start = localCalendarParts(event.start!.dateTime!); const end = localCalendarParts(event.end!.dateTime!); return { date: start.date, start_time: start.time, end_time: end.time, label: event.title }; }).filter((event) => event.date && event.start_time < event.end_time); const importedTasks = imported.events.filter((event) => event.start?.date && !event.start?.dateTime).map((event) => ({ id: `google-${event.calendarId}-${event.id}`, title: event.title, course: event.calendarName || "Imported calendar", due_date: event.start!.date!, estimated_minutes: 60, priority: 3, course_weight: 10 })); setCalendarBusyTime(busy); setTasks((current) => [...current, ...importedTasks.filter((candidate) => !current.some((task) => task.id === candidate.id))]); setCalendarConnected(true); setMessage(`Calendar synced across ${imported.calendarsScanned} calendars: ${busy.length} busy events protected and ${importedTasks.length} all-day items added for review.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Google Calendar could not connect."); } finally { setCalendarImporting(false); } }
  function openCanvasModal() { if (canvasConnected) { setCanvasStep("connected"); } else { setCanvasUrlDraft(""); setCanvasToken(""); setCanvasStep("url"); } }
  function closeCanvasModal() { setCanvasStep("idle"); setCanvasToken(""); }
  async function handleCanvasConnect() {
    if (!canvasUrlDraft.trim() || !canvasToken.trim()) return;
    setCanvasStep("connecting"); setCanvasError("");
    try {
      const result = await apiConnectCanvas(apiUrl, canvasUrlDraft.trim(), canvasToken);
      setCanvasUser(result.display_name); setCanvasCourses(result.courses);
      setCanvasSelectedIds(new Set(result.courses.map((c) => c.id)));
      setCanvasStep("review");
    } catch (error) { setCanvasError(error instanceof Error ? error.message : "Could not connect to Canvas."); setCanvasStep("error"); }
  }
  async function handleCanvasSync() {
    setCanvasStep("syncing"); setCanvasError("");
    try {
      const selectedIds = [...canvasSelectedIds];
      const result = await apiSyncCanvas(apiUrl, canvasUrlDraft.trim(), canvasToken, selectedIds.length < canvasCourses.length ? selectedIds : undefined);
      const today = new Date().toISOString().slice(0, 10);
      const newTasks = result.assignments
        .filter((a) => a.due_at && a.due_at.slice(0, 10) >= today)
        .map((a: CanvasAssignment) => { const course = canvasCourses.find((c) => c.id === a.course_id); return { id: `canvas-${a.id}`, title: a.title, course: course?.course_code ?? a.course_id, due_date: a.due_at!.slice(0, 10), estimated_minutes: 60, priority: 3, course_weight: 10 }; });
      setTasks((current) => [...current, ...newTasks.filter((t) => !current.some((c) => c.id === t.id))]);
      setCanvasAssignmentCount(newTasks.length); setCanvasToken("");
      setCanvasStep("connected");
      setMessage(`Canvas synced: ${newTasks.length} upcoming assignment${newTasks.length !== 1 ? "s" : ""} imported from ${result.courses_scanned} course${result.courses_scanned !== 1 ? "s" : ""}.`);
    } catch (error) { setCanvasError(error instanceof Error ? error.message : "Could not sync Canvas assignments."); setCanvasStep("error"); }
  }
  function toggleCanvasCourse(id: string) { setCanvasSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  const firstSession = plan?.sessions[0];
  return <main className="flow-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grain" />
    <aside className="rail"><div className="logo"><span><Icon name="spark" /></span>StudyFlow</div><div className="rail-label">YOUR SPACE</div><nav><a className="active" href="#today"><Icon name="bolt" />Today</a><a href="#work"><Icon name="canvas" />Workload</a><a href="#connections"><Icon name="calendar" />Connections</a><a href="#preferences"><Icon name="settings" />Preferences</a></nav><div className="rail-footer"><div className="identity">JK</div><div><strong>Jishnu</strong><small>UCSC · Student</small></div></div></aside>
    <section className="workspace"><header className="topbar"><div><p className="kicker">SATURDAY · NOVEMBER 15</p><h1>Make room for <em>what matters.</em></h1></div><button className="glow-button" onClick={generatePlan} disabled={loading}><Icon name="spark" />{loading ? "Building flow…" : "Generate my flow"}</button></header>{message && <div className="toast" role="status"><Icon name="check" />{message}</div>}
      <section id="connections" className="connection-ribbon"><div className="ribbon-copy"><span className="orb"><Icon name="spark" /></span><div><p className="kicker">ONE-TIME SETUP</p><h2>Your life, already in motion.</h2><p>Connect once. StudyFlow turns calendar reality into a plan—no schedule transcription.</p></div></div><div className="connection-actions"><button className="connection-card" onClick={connectGoogleCalendar} disabled={calendarImporting}><span className="google-mark">G</span><div><strong>{calendarConnected ? "Google Calendar synced" : "Google Calendar"}</strong><small>{calendarImporting ? "Reading your calendar…" : calendarConnected ? `${calendarBusyTime.length} events protected` : "Read-only · import busy time"}</small></div><Icon name={calendarConnected ? "check" : "arrow"} /></button><button className="connection-card canvas-card" onClick={openCanvasModal}><span className="canvas-mark"><Icon name="canvas" /></span><div><strong>{canvasConnected ? "Canvas synced" : "Canvas LMS"}</strong><small>{canvasConnected ? `${canvasAssignmentCount} assignment${canvasAssignmentCount !== 1 ? "s" : ""} imported` : "Import courses · assignments"}</small></div><Icon name={canvasConnected ? "check" : "arrow"} /></button></div></section>
      <section id="today" className="hero-grid"><article className="now-card"><div className="card-eyebrow"><span className="live-dot" /> YOUR NEXT MOVE</div><div className="now-main"><div className="course-pill purple">{firstSession?.course ?? "STUDYFLOW"}</div><h2>{firstSession?.task_title ?? "Build your first flow"}</h2><p>{firstSession ? `${firstSession.minutes} minutes protected for focused work.` : "Connect your schedule and let StudyFlow make the calls."}</p></div><div className="now-footer"><div><span>Start</span><strong>{firstSession ? new Date(firstSession.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "When ready"}</strong></div><div><span>Why now</span><strong>{plan ? "Deadline + impact" : "Your week, first"}</strong></div><button onClick={generatePlan} aria-label="Generate plan"><Icon name="arrow" /></button></div></article><article className="pulse-card"><div className="card-eyebrow">WEEKLY PULSE <span>{plan ? `${plan.risk} risk` : "waiting"}</span></div><div className="pulse-number">{plan ? Math.round((plan.scheduled_minutes / Math.max(plan.requested_minutes, 1)) * 100) : 0}<small>%</small></div><p>{plan ? `${formatHours(plan.scheduled_minutes)} placed into your real week.` : "Your plan will show up here."}</p><div className="progress-track"><span style={{ width: `${plan ? Math.min(100, (plan.scheduled_minutes / Math.max(plan.requested_minutes, 1)) * 100) : 0}%` }} /></div></article><article className="mini-stats"><div><span>Due soon</span><strong>{tasks.length}</strong><small>across {courses.length} courses</small></div><div><span>Workload</span><strong>{formatHours(requestedMinutes)}</strong><small>estimated focus</small></div></article></section>
      <section id="work" className="content-grid"><article className="surface timeline-surface"><div className="surface-head"><div><p className="kicker">THE FLOW</p><h2>Tonight, with breathing room.</h2></div><div className="legend"><span><i className="purple-dot" /> Deep work</span><span><i className="mint-dot" /> Open time</span></div></div><div className="timeline"><div className="time-labels"><span>6 PM</span><span>7 PM</span><span>8 PM</span><span>9 PM</span></div><div className="timeline-track"><div className="study-block study-one"><span>6:30</span><strong>{firstSession?.task_title ?? "Your first session"}</strong><small>{firstSession?.minutes ?? 50} min · {firstSession?.course ?? "CSE 101"}</small></div><div className="timeline-break">space to reset</div><div className="study-block study-two"><span>7:40</span><strong>{plan?.sessions[1]?.task_title ?? "Your second session"}</strong><small>{plan?.sessions[1]?.minutes ?? 50} min · {plan?.sessions[1]?.course ?? "STAT 131"}</small></div></div></div><button className="quiet-action" onClick={generatePlan}>See full plan <Icon name="arrow" /></button></article><article className="surface workload-surface"><div className="surface-head"><div><p className="kicker">UPCOMING</p><h2>Keep the important things close.</h2></div><button className="icon-button" onClick={() => setShowCapture((current) => !current)} aria-label="Add coursework"><Icon name="plus" /></button></div><div className="task-stack">{tasks.slice(0, 4).map((task, index) => <div className="task-row" key={task.id}><span className="task-color" style={{ background: courseColors[index % courseColors.length] }} /><div><strong>{task.title}</strong><small>{task.course} · due {task.due_date.slice(5).replace("-", "/")}</small></div><span className="task-time">{formatHours(task.estimated_minutes)}</span></div>)}</div><button className="quiet-action" onClick={() => setShowCapture((current) => !current)}>Add something manually <Icon name="plus" /></button>{showCapture && <form className="capture-form" onSubmit={addTask}><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What needs doing?" /><div><input required value={draft.course} onChange={(event) => setDraft({ ...draft, course: event.target.value })} placeholder="Course" /><input required type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} /><input required min="15" step="15" type="number" value={draft.estimated_minutes} onChange={(event) => setDraft({ ...draft, estimated_minutes: event.target.value })} aria-label="Minutes" /></div><button className="glow-button" type="submit">Add to flow</button></form>}</article></section>
      {plan?.warnings.length ? <section className="warnings">{plan.warnings.map((warning) => <p key={warning}><span>!</span>{warning}</p>)}</section> : null}
      <section id="preferences" className="preferences-panel"><button className="preferences-trigger" onClick={() => setShowPreferences((current) => !current)}><span><Icon name="settings" /></span><div><p className="kicker">GUARDRAILS</p><strong>Shape a plan around your actual life</strong><small>Availability, sleep, meals, work, and commitments</small></div><Icon name="arrow" /></button>{showPreferences && <div className="preferences-body"><div className="availability-editor"><h3>When can you study?</h3>{availability.map((day) => <div className="availability-row" key={day.day_of_week}><strong>{day.label}</strong><label><input type="checkbox" checked={!day.is_day_off} onChange={(event) => updateAvailability(day.day_of_week, { is_day_off: !event.target.checked })} />Available</label><input type="time" disabled={day.is_day_off} value={day.start_time.slice(0, 5)} onChange={(event) => updateAvailability(day.day_of_week, { start_time: `${event.target.value}:00` })} /><span>to</span><input type="time" disabled={day.is_day_off} value={day.end_time.slice(0, 5)} onChange={(event) => updateAvailability(day.day_of_week, { end_time: `${event.target.value}:00` })} /></div>)}</div><div className="guardrail-editor"><h3>Protect your rhythm</h3><div className="field-grid"><label>Sleep<input type="time" value={preferences.sleep_start.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, sleep_start: `${event.target.value}:00` })} /></label><label>Wake<input type="time" value={preferences.wake_time.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, wake_time: `${event.target.value}:00` })} /></label><label>Focus block<input min="25" max="120" type="number" value={preferences.focus_session_minutes} onChange={(event) => setPreferences({ ...preferences, focus_session_minutes: event.target.value })} /></label><label>Daily cap<input min="60" max="720" step="30" type="number" value={preferences.max_study_minutes_per_day} onChange={(event) => setPreferences({ ...preferences, max_study_minutes_per_day: event.target.value })} /></label></div><div className="protected-form"><input value={protectedDraft.label} onChange={(event) => setProtectedDraft({ ...protectedDraft, label: event.target.value })} placeholder="Protect a commitment" /><input type="time" value={protectedDraft.start_time.slice(0, 5)} onChange={(event) => setProtectedDraft({ ...protectedDraft, start_time: `${event.target.value}:00` })} /><input type="time" value={protectedDraft.end_time.slice(0, 5)} onChange={(event) => setProtectedDraft({ ...protectedDraft, end_time: `${event.target.value}:00` })} /><button type="button" onClick={addProtectedBlock}><Icon name="plus" /></button></div><div className="day-pills">{week.map((day) => <button type="button" className={protectedDraft.days_of_week.includes(day.day_of_week) ? "selected" : ""} onClick={() => toggleProtectedDay(day.day_of_week)} key={day.day_of_week}>{day.label}</button>)}</div>{protectedBlocks.map((block, index) => <div className="protected-item" key={`${block.label}-${index}`}><span>{block.label} · {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}</span><button onClick={() => setProtectedBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div></div>}</section>
    </section>
      {canvasStep !== "idle" && (
        <CanvasErrorBoundary onClose={closeCanvasModal}>
        <div className="canvas-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCanvasModal(); }} role="dialog" aria-modal="true" aria-label="Connect Canvas LMS">
          <div className="canvas-modal">
            <div className="canvas-modal-header">
              {canvasStep === "token" && <button className="canvas-back" onClick={() => setCanvasStep("url")}>&#8592; Back</button>}
              {canvasStep === "review" && <button className="canvas-back" onClick={() => setCanvasStep("token")}>&#8592; Back</button>}
              <button className="canvas-close" onClick={closeCanvasModal} aria-label="Close">&#215;</button>
            </div>
            {canvasStep === "url" && (
              <div className="canvas-step">
                <div className="canvas-modal-icon"><Icon name="canvas" /></div>
                <h2>Connect Canvas</h2>
                <p>Import your courses and upcoming assignments automatically.</p>
                <label className="canvas-field"><span>Your school&#8217;s Canvas URL</span><input type="text" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="canvas.university.edu" value={canvasUrlDraft} onChange={(e) => setCanvasUrlDraft(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && canvasUrlDraft.trim()) setCanvasStep("token"); }} /><small>The URL your school uses for Canvas</small></label>
                <div className="canvas-modal-actions"><button className="glow-button" disabled={!canvasUrlDraft.trim()} onClick={() => setCanvasStep("token")}>Continue <Icon name="arrow" /></button></div>
              </div>
            )}
            {canvasStep === "token" && (
              <div className="canvas-step">
                <div className="canvas-modal-icon"><Icon name="canvas" /></div>
                <h2>Access token</h2>
                <p>Generate a personal access token in Canvas, then paste it here.</p>
                <label className="canvas-field"><span>Access token</span><input type="password" placeholder="Paste your Canvas access token" value={canvasToken} onChange={(e) => setCanvasToken(e.target.value)} autoFocus autoComplete="new-password" onKeyDown={(e) => { if (e.key === "Enter" && canvasToken.trim()) void handleCanvasConnect(); }} /></label>
                <div className="canvas-token-notice"><Icon name="check" /><span>Sent to StudyFlow&#8217;s backend only. Never stored, logged, or shared beyond this session.</span></div>
                <div className="canvas-modal-actions"><button className="glow-button" disabled={!canvasToken.trim()} onClick={() => void handleCanvasConnect()}>Connect Canvas <Icon name="arrow" /></button></div>
              </div>
            )}
            {(canvasStep === "connecting" || canvasStep === "syncing") && (
              <div className="canvas-step canvas-loading">
                <div className="canvas-spinner" />
                <p>{canvasStep === "connecting" ? "Connecting to Canvas…" : "Importing assignments…"}</p>
              </div>
            )}
            {canvasStep === "review" && (
              <div className="canvas-step">
                <div className="canvas-modal-icon"><Icon name="canvas" /></div>
                <h2>Your courses</h2>
                <p className="canvas-user-name">Signed in as {canvasUser}</p>
                <div className="canvas-course-list">{canvasCourses.map((course) => (<label key={course.id} className="canvas-course-item"><input type="checkbox" checked={canvasSelectedIds.has(course.id)} onChange={() => toggleCanvasCourse(course.id)} /><div><strong>{course.name}</strong><small>{course.course_code}{course.term ? ` · ${course.term}` : ""}</small></div></label>))}</div>
                <p className="canvas-select-count">{canvasSelectedIds.size} of {canvasCourses.length} courses selected</p>
                <div className="canvas-modal-actions"><button className="glow-button" disabled={canvasSelectedIds.size === 0} onClick={() => void handleCanvasSync()}>Import assignments <Icon name="arrow" /></button></div>
              </div>
            )}
            {canvasStep === "connected" && (
              <div className="canvas-step canvas-success-step">
                <div className="canvas-success-icon"><Icon name="check" /></div>
                <h2>Canvas synced</h2>
                <p>{canvasAssignmentCount} upcoming assignment{canvasAssignmentCount !== 1 ? "s" : ""} added from {canvasCourses.length} course{canvasCourses.length !== 1 ? "s" : ""}.</p>
                <div className="canvas-modal-actions"><button className="glow-button" onClick={closeCanvasModal}>Done</button><button className="quiet-action" onClick={() => { setCanvasToken(""); setCanvasStep("url"); }}>Re-sync</button></div>
              </div>
            )}
            {canvasStep === "error" && (
              <div className="canvas-step canvas-error-step">
                <div className="canvas-error-icon">!</div>
                <h2>Connection failed</h2>
                <p className="canvas-error-msg">{canvasError}</p>
                <div className="canvas-modal-actions"><button className="glow-button" onClick={() => setCanvasStep("token")}>Try again</button><button className="quiet-action" onClick={closeCanvasModal}>Cancel</button></div>
              </div>
            )}
          </div>
        </div>
        </CanvasErrorBoundary>
      )}
    </main>;
}
