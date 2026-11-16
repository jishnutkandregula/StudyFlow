"use client";

import { FormEvent, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  course: string;
  due_date: string;
  estimated_minutes: number;
  priority: number;
  course_weight: number;
};

type Session = {
  task_id: string;
  task_title: string;
  course: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  explanation: string;
};

type Plan = {
  sessions: Session[];
  unscheduled: Array<{ task_title: string; course: string; remaining_minutes: number; risk: string; reason: string }>;
  scheduled_minutes: number;
  requested_minutes: number;
  available_minutes: number;
  risk: "low" | "medium" | "high";
  explanation: string;
  warnings: string[];
};

type DailyAvailability = {
  day_of_week: number;
  label: string;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};

type ProtectedBlock = {
  label: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

const initialTasks: Task[] = [
  { id: "lab-4", title: "Lab 4 — Graph traversal", course: "CSE 101", due_date: "2026-11-19", estimated_minutes: 180, priority: 5, course_weight: 20 },
  { id: "stats-set", title: "Problem set 7", course: "STAT 131", due_date: "2026-11-20", estimated_minutes: 120, priority: 4, course_weight: 15 },
  { id: "reading", title: "Reading response", course: "CSE 102", due_date: "2026-11-18", estimated_minutes: 45, priority: 3, course_weight: 5 },
];

const week: DailyAvailability[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
].map((label, day_of_week) => ({
  day_of_week,
  label,
  start_time: day_of_week < 5 ? "18:30:00" : "10:00:00",
  end_time: day_of_week < 5 ? "21:30:00" : "14:00:00",
  is_day_off: false,
}));

function hours(minutes: number) {
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ title: "", course: "", due_date: "", estimated_minutes: "60", priority: "3" });
  const [availability, setAvailability] = useState<DailyAvailability[]>(week);
  const [protectedBlocks, setProtectedBlocks] = useState<ProtectedBlock[]>([]);
  const [protectedDraft, setProtectedDraft] = useState<ProtectedBlock>({
    label: "",
    days_of_week: [0],
    start_time: "17:00:00",
    end_time: "18:00:00",
  });
  const [preferences, setPreferences] = useState({
    sleep_start: "23:00:00",
    wake_time: "07:00:00",
    lunch_start: "12:00:00",
    lunch_end: "13:00:00",
    dinner_start: "18:00:00",
    dinner_end: "19:00:00",
    focus_session_minutes: "50",
    short_break_minutes: "10",
    max_study_minutes_per_day: "240",
  });

  const courses = useMemo(() => [...new Set(tasks.map((task) => task.course))], [tasks]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.course.trim() || !draft.due_date) return;
    setTasks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        course: draft.course.trim(),
        due_date: draft.due_date,
        estimated_minutes: Number(draft.estimated_minutes),
        priority: Number(draft.priority),
        course_weight: Number(draft.priority) * 5,
      },
    ]);
    setDraft({ title: "", course: "", due_date: "", estimated_minutes: "60", priority: "3" });
    setMessage("Added. Generate a plan when you are ready.");
  }

  async function generatePlan() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/plans/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          recurring_availability: availability.map(({ label, ...item }) => item),
          protected_time: protectedBlocks,
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
        }),
      });
      if (!response.ok) throw new Error("StudyFlow could not generate your plan.");
      setPlan(await response.json());
      setMessage("Your plan is ready. Every session includes an explanation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the planning service.");
    } finally {
      setLoading(false);
    }
  }

  function skipSession(session: Session) {
    setPlan((current) => current ? {
      ...current,
      sessions: current.sessions.filter((item) => item !== session),
      unscheduled: [...current.unscheduled, {
        task_title: session.task_title,
        course: session.course,
        remaining_minutes: session.minutes,
        risk: "medium",
        reason: "This session was skipped. Regenerate your plan to see the best recovery options.",
      }],
      risk: "medium",
    } : current);
    setMessage("Session marked skipped. Regenerate to build a recovery plan around the remaining work.");
  }

  function updateAvailability(day: number, changes: Partial<DailyAvailability>) {
    setAvailability((current) => current.map((item) => item.day_of_week === day ? { ...item, ...changes } : item));
  }

  function toggleProtectedDay(day: number) {
    setProtectedDraft((current) => ({
      ...current,
      days_of_week: current.days_of_week.includes(day)
        ? current.days_of_week.filter((item) => item !== day)
        : [...current.days_of_week, day],
    }));
  }

  function addProtectedBlock() {
    if (!protectedDraft.label.trim() || !protectedDraft.days_of_week.length) return;
    setProtectedBlocks((current) => [...current, { ...protectedDraft, label: protectedDraft.label.trim() }]);
    setProtectedDraft({ label: "", days_of_week: [0], start_time: "17:00:00", end_time: "18:00:00" });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">StudyFlow</div>
        <p className="eyebrow">MANUAL MVP</p>
        <nav aria-label="StudyFlow sections">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#coursework">Coursework</a>
          <a href="#plan">Weekly plan</a>
          <a href="#preferences">Preferences</a>
        </nav>
        <div className="sidebar-note">Build a plan around your life—not an imaginary empty calendar.</div>
      </aside>

      <section className="content">
        <header id="dashboard" className="page-header">
          <div>
            <p className="eyebrow">ADAPTIVE ACADEMIC PLANNING</p>
            <h1>Know what to do next.</h1>
            <p>Enter work, generate a realistic plan, and recover when your week changes.</p>
          </div>
          <button className="primary" onClick={generatePlan} disabled={loading || tasks.length === 0}>
            {loading ? "Planning…" : "Generate plan"}
          </button>
        </header>

        {message && <p className="notice" role="status">{message}</p>}

        <section className="overview" aria-label="Planning summary">
          <article className="metric-card">
            <span>Coursework</span>
            <strong>{tasks.length}</strong>
            <small>{courses.length} courses this week</small>
          </article>
          <article className="metric-card">
            <span>Estimated work</span>
            <strong>{hours(tasks.reduce((total, task) => total + task.estimated_minutes, 0))}</strong>
            <small>Across everything you entered</small>
          </article>
          <article className={`metric-card ${plan?.risk ?? "neutral"}`}>
            <span>Workload risk</span>
            <strong>{plan ? plan.risk : "Not checked"}</strong>
            <small>{plan ? plan.explanation : "Generate a plan to check capacity"}</small>
          </article>
        </section>

        <section id="coursework" className="two-column">
          <article className="panel">
            <div className="panel-heading"><div><p className="eyebrow">COURSEWORK</p><h2>Your work</h2></div><span>{tasks.length} items</span></div>
            <div className="task-list">
              {tasks.map((task) => (
                <div className="task" key={task.id}>
                  <div><strong>{task.title}</strong><small>{task.course} · Due {task.due_date}</small></div>
                  <div className="task-meta"><span>{hours(task.estimated_minutes)}</span><span>Priority {task.priority}</span></div>
                </div>
              ))}
            </div>
          </article>

          <form className="panel form" onSubmit={addTask}>
            <div className="panel-heading"><div><p className="eyebrow">ADD WORK</p><h2>Capture an assignment</h2></div></div>
            <label>Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Lab 5 — Graph algorithms" /></label>
            <label>Course<input required value={draft.course} onChange={(event) => setDraft({ ...draft, course: event.target.value })} placeholder="CSE 101" /></label>
            <div className="form-row"><label>Due date<input required type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} /></label><label>Minutes<input required min="15" step="15" type="number" value={draft.estimated_minutes} onChange={(event) => setDraft({ ...draft, estimated_minutes: event.target.value })} /></label></div>
            <label>Importance<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="1">Low</option><option value="2">Moderate</option><option value="3">Important</option><option value="4">High</option><option value="5">Critical</option></select></label>
            <button className="secondary" type="submit">Add to coursework</button>
          </form>
        </section>

        <section id="plan" className="plan-section">
          <div className="section-heading"><div><p className="eyebrow">WEEKLY PLAN</p><h2>Suggested focused sessions</h2></div>{plan && <span className={`risk-chip ${plan.risk}`}>{plan.risk} risk</span>}</div>
          {!plan ? <div className="empty-state"><strong>Your plan will appear here.</strong><p>StudyFlow uses a deadline-first, explainable baseline. It never hides an overload.</p></div> : (
            <div className="plan-grid">
              <article className="panel sessions"><h3>Next sessions</h3>{plan.sessions.length ? plan.sessions.map((session) => <div className="session" key={`${session.task_id}-${session.starts_at}`}><div><strong>{session.task_title}</strong><small>{session.course} · {new Date(session.starts_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} · {session.minutes} min</small><p>{session.explanation}</p></div><button className="text-button" onClick={() => skipSession(session)}>Skip</button></div>) : <p className="muted">No sessions fit the availability you provided.</p>}</article>
              <article className="panel recovery"><h3>Recovery & risk</h3><p><strong>{hours(plan.scheduled_minutes)}</strong> scheduled out of <strong>{hours(plan.requested_minutes)}</strong> requested.</p>{plan.unscheduled.length ? plan.unscheduled.map((item) => <div className="risk-item" key={`${item.task_title}-${item.remaining_minutes}`}><strong>{item.task_title}</strong><span>{hours(item.remaining_minutes)} remain · {item.risk} risk</span><p>{item.reason}</p></div>) : <div className="success">Everything currently fits. Keep checking in as estimates change.</div>}</article>
            </div>
          )}
          {plan?.warnings.length ? <div className="warnings">{plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
        </section>

        <section id="preferences" className="preferences">
          <div className="section-heading"><div><p className="eyebrow">YOUR REAL WEEK</p><h2>Availability & preferences</h2><p>Tell StudyFlow when you can study. It will leave sleep, meals, and commitments alone.</p></div></div>
          <div className="preference-grid">
            <div className="settings-card">
              <h3>Weekly availability</h3>
              <div className="availability-list">
                {availability.map((day) => <div className="availability-row" key={day.day_of_week}>
                  <strong>{day.label.slice(0, 3)}</strong>
                  <label className="check-label"><input type="checkbox" checked={!day.is_day_off} onChange={(event) => updateAvailability(day.day_of_week, { is_day_off: !event.target.checked })} /> Available</label>
                  <input aria-label={`${day.label} start time`} type="time" disabled={day.is_day_off} value={day.start_time.slice(0, 5)} onChange={(event) => updateAvailability(day.day_of_week, { start_time: `${event.target.value}:00` })} />
                  <span>to</span>
                  <input aria-label={`${day.label} end time`} type="time" disabled={day.is_day_off} value={day.end_time.slice(0, 5)} onChange={(event) => updateAvailability(day.day_of_week, { end_time: `${event.target.value}:00` })} />
                </div>)}
              </div>
            </div>
            <div className="settings-card settings-form">
              <h3>Guardrails</h3>
              <div className="form-row"><label>Sleep starts<input type="time" value={preferences.sleep_start.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, sleep_start: `${event.target.value}:00` })} /></label><label>Wake time<input type="time" value={preferences.wake_time.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, wake_time: `${event.target.value}:00` })} /></label></div>
              <div className="form-row"><label>Lunch starts<input type="time" value={preferences.lunch_start.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, lunch_start: `${event.target.value}:00` })} /></label><label>Lunch ends<input type="time" value={preferences.lunch_end.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, lunch_end: `${event.target.value}:00` })} /></label></div>
              <div className="form-row"><label>Dinner starts<input type="time" value={preferences.dinner_start.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, dinner_start: `${event.target.value}:00` })} /></label><label>Dinner ends<input type="time" value={preferences.dinner_end.slice(0, 5)} onChange={(event) => setPreferences({ ...preferences, dinner_end: `${event.target.value}:00` })} /></label></div>
              <div className="form-row"><label>Focus minutes<input min="25" max="120" type="number" value={preferences.focus_session_minutes} onChange={(event) => setPreferences({ ...preferences, focus_session_minutes: event.target.value })} /></label><label>Daily study cap<input min="60" max="720" step="30" type="number" value={preferences.max_study_minutes_per_day} onChange={(event) => setPreferences({ ...preferences, max_study_minutes_per_day: event.target.value })} /></label></div>
            </div>
          </div>
          <div className="settings-card protected-card">
            <div className="panel-heading"><div><h3>Protected commitments</h3><p className="muted">Work, meetings, practice—anything StudyFlow must never schedule over.</p></div></div>
            <div className="protected-form"><input aria-label="Commitment name" value={protectedDraft.label} onChange={(event) => setProtectedDraft({ ...protectedDraft, label: event.target.value })} placeholder="e.g. Club meeting" /><input aria-label="Commitment start time" type="time" value={protectedDraft.start_time.slice(0, 5)} onChange={(event) => setProtectedDraft({ ...protectedDraft, start_time: `${event.target.value}:00` })} /><input aria-label="Commitment end time" type="time" value={protectedDraft.end_time.slice(0, 5)} onChange={(event) => setProtectedDraft({ ...protectedDraft, end_time: `${event.target.value}:00` })} /><button className="secondary" type="button" onClick={addProtectedBlock}>Protect time</button></div>
            <div className="day-picker">{week.map((day) => <label key={day.day_of_week}><input type="checkbox" checked={protectedDraft.days_of_week.includes(day.day_of_week)} onChange={() => toggleProtectedDay(day.day_of_week)} /> {day.label.slice(0, 3)}</label>)}</div>
            {protectedBlocks.length ? <div className="protected-list">{protectedBlocks.map((block, index) => <div key={`${block.label}-${index}`}><span><strong>{block.label}</strong> · {block.days_of_week.map((day) => week[day].label.slice(0, 3)).join(", ")} · {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}</span><button className="text-button" onClick={() => setProtectedBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="muted">No protected commitments yet.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
