import { dayLabel, formatClock, formatDue, formatHours, plural, toDateKey } from "../lib/format";
import type { Plan, RiskLevel, Task } from "../lib/types";
import { Icon } from "./Icon";

type Props = {
  now: Date | null;
  tasks: Task[];
  plan: Plan | null;
  loading: boolean;
  courseColor: (course: string) => string;
  onGenerate: () => void;
  onOpenCanvas: () => void;
  onAddManual: () => void;
};

export const healthCopy: Record<RiskLevel, { label: string; detail: string }> = {
  low: { label: "On track", detail: "Everything fits before its deadline." },
  medium: { label: "Tight", detail: "Some work doesn’t fit yet — nothing is due in the next day." },
  high: { label: "At risk", detail: "Work due within a day doesn’t fit your available time." },
};

export function TodayOverview({ now, tasks, plan, loading, courseColor, onGenerate, onOpenCanvas, onAddManual }: Props) {
  const nextSession = plan?.sessions.find((session) => !now || new Date(session.ends_at) > now);
  const nextTask = nextSession && tasks.find((task) => task.id === nextSession.task_id);
  const requested = tasks.reduce((total, task) => total + task.estimated_minutes, 0);
  const courseCount = new Set(tasks.map((task) => task.course)).size;
  const coverage = plan ? Math.round((plan.scheduled_minutes / Math.max(plan.requested_minutes, 1)) * 100) : null;
  const inProgress = nextSession && now && new Date(nextSession.starts_at) <= now;

  return (
    <section id="today" className="hero-grid" aria-label="Today">
      <article className="now-card" aria-live="polite">
        {!tasks.length ? (
          <>
            <div className="card-eyebrow"><span className="live-dot" /> GET STARTED</div>
            <div className="now-main">
              <h2>Bring in your coursework</h2>
              <p>Import assignments from Canvas or add one by hand. StudyFlow plans around your real week.</p>
            </div>
            <div className="now-actions">
              <button className="glow-button" onClick={onOpenCanvas}><Icon name="canvas" />Import from Canvas</button>
              <button className="ghost-button" onClick={onAddManual}><Icon name="plus" />Add manually</button>
            </div>
          </>
        ) : !plan ? (
          <>
            <div className="card-eyebrow"><span className="live-dot" /> READY WHEN YOU ARE</div>
            <div className="now-main">
              <h2>{plural(tasks.length, "assignment")} waiting for a plan</h2>
              <p>{formatHours(requested)} of estimated work. Generate a plan to see what to do first.</p>
            </div>
            <div className="now-actions">
              <button className="glow-button" onClick={onGenerate} disabled={loading}>
                <Icon name="spark" />{loading ? "Building your plan…" : "Generate my plan"}
              </button>
            </div>
          </>
        ) : nextSession ? (
          <>
            <div className="card-eyebrow"><span className="live-dot" /> {inProgress ? "HAPPENING NOW" : "YOUR NEXT MOVE"}</div>
            <div className="now-main">
              <div className="course-pill" style={{ color: courseColor(nextSession.course), background: `${courseColor(nextSession.course)}22` }}>
                {nextSession.course}
              </div>
              <h2>{nextSession.task_title}</h2>
              <p>{nextSession.minutes} minutes of focused work, protected from everything else.</p>
            </div>
            <div className="now-footer">
              <div>
                <span>When</span>
                <strong suppressHydrationWarning>
                  {dayLabel(toDateKey(new Date(nextSession.starts_at)), now)} · {formatClock(nextSession.starts_at)}
                </strong>
              </div>
              {nextTask && (
                <div>
                  <span>Due</span>
                  <strong suppressHydrationWarning>{formatDue(nextTask.due_date, nextTask.due_time, now)}</strong>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="card-eyebrow"><span className="live-dot" /> ALL CLEAR</div>
            <div className="now-main">
              <h2>No sessions left in this plan</h2>
              <p>{plan.unscheduled.length ? "Some work didn’t fit — see what needs attention below." : "Everything is handled. Enjoy the breathing room."}</p>
            </div>
          </>
        )}
      </article>

      <article className="pulse-card">
        <div className="card-eyebrow">
          SCHEDULE HEALTH
          {plan && <span className={`health-badge ${plan.risk}`}>{healthCopy[plan.risk].label}</span>}
        </div>
        <div className="pulse-number">
          {coverage ?? "—"}
          {coverage !== null && <small>%</small>}
        </div>
        <p>
          {plan
            ? `${formatHours(plan.scheduled_minutes)} of ${formatHours(plan.requested_minutes)} placed into your real week. ${healthCopy[plan.risk].detail}`
            : "Generate a plan to see how much of your workload fits before each deadline."}
        </p>
        <div className="progress-track" role="progressbar" aria-label="Workload scheduled" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage ?? 0}>
          <span className={plan?.risk ?? ""} style={{ width: `${Math.min(100, coverage ?? 0)}%` }} />
        </div>
      </article>

      <article className="mini-stats">
        <div>
          <span>Assignments</span>
          <strong>{tasks.length}</strong>
          <small>{courseCount ? `across ${plural(courseCount, "course")}` : "none yet"}</small>
        </div>
        <div>
          <span>{plan ? "Free study time" : "Workload"}</span>
          <strong>{formatHours(plan ? plan.available_minutes : requested)}</strong>
          <small>{plan ? "before your last deadline" : "estimated focus"}</small>
        </div>
      </article>
    </section>
  );
}
